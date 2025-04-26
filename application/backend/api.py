import logging
import os
import time
import uuid
import json
import re
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from google import genai
from google.genai import types
from typing import Dict

# Import modules
from models import PromptRequest, AggregationDefinition
from visualization_recommender import classify_dimensions, get_chart_options, is_topn_query
from query_engine import (
    extract_json_from_text, 
    create_text_response,
    generate_sql, 
    execute_sql_in_duckDB, 
    calculate_dimension_cardinality_stats, 
    reorder_dimensions_by_cardinality
)
from text_insights import generate_data_description
from query_translator import translate_query  # Use the dedicated module

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# App initialization
load_dotenv()
app = FastAPI()

# Configure middleware
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://takumanken.github.io", "http://127.0.0.1:5500"],
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# Constants
SYSTEM_INSTRUCTION_FILE = "gemini_instructions/data_aggregation_instruction.md"
FILTER_VALUES_FILE = "gemini_instructions/references/all_filters.json"
DATA_SCHEMA_FILE = "data/data_schema.json"
DUCKDB_FILE = "data/nyc_open_data_explorer.duckdb"

# Load data schema
with open(DATA_SCHEMA_FILE, "r") as f:
    data_schema = json.load(f)

# Environment setup
def setup_environment():
    """
    Loads system instructions and initializes the Gemini API client.
    
    Returns:
        Tuple containing the formatted system instruction and initialized API client.
    """
    with open(SYSTEM_INSTRUCTION_FILE, "r") as f:
        system_instruction = f.read()

    # Load filter values
    with open(FILTER_VALUES_FILE, "r") as f:
        all_filters = json.load(f)
        
    # Prepare simplified schema for AI - remove description_to_user to avoid confusion
    simplified_schema = {"dimensions": {}, "measures": []}

    # Process dimensions
    for dim_type, dims in data_schema["dimensions"].items():
        simplified_schema["dimensions"][dim_type] = []
        
        for dim in dims:
            dim_copy = {k: v for k, v in dim.items() if k != "description_to_user"}
            simplified_schema["dimensions"][dim_type].append(dim_copy)

    # Process measures
    for measure in data_schema["measures"]:
        measure_copy = {k: v for k, v in measure.items() if k != "description_to_user"}
        simplified_schema["measures"].append(measure_copy)
                
    # Replace the placeholders
    system_instruction = system_instruction.replace("{all_filters}", json.dumps(all_filters))
    system_instruction = system_instruction.replace("{data_schema}", json.dumps(simplified_schema))
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable not set")
        raise ValueError("GEMINI_API_KEY is required")
        
    return system_instruction, genai.Client(api_key=api_key)

# Initialize environment
system_instruction, client = setup_environment()
logger.info("Environment setup completed")

# API endpoint
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    """
    Main endpoint for processing natural language prompts.
    """
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Processing: '{request_data.prompt[:50]}...'")
    start_time = time.time()
    
    try:
        # Extract and process location data if available
        user_location = None
        content = request_data.prompt
        
        if hasattr(request_data, 'location') and request_data.location:
            user_location = request_data.location
            logger.info(f"[{request_id}] Location: lat={user_location.get('latitude'):.6f}, lng={user_location.get('longitude'):.6f}")
            content = f"{request_data.prompt}\n[USER_LOCATION_AVAILABLE: TRUE]"

        # Use the translator function to get query caveats
        caveats = translate_query(content)
        
        # Add caveats to the prompt
        gemini_model = "gemini-2.0-flash"
        prompt = content + "\n\n\nCAVEATS TO THIS QUERY:\n" + caveats
        logger.info(f"[{request_id}] Prompt with caveats: {prompt}")

        # Call Gemini API to process the prompt
        response = client.models.generate_content(
            model=gemini_model,
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0),
            contents=[prompt],
        )
        
        # Parse the AI response
        json_text = response.candidates[0].content.parts[0].text
        parsed_json, is_valid_json = extract_json_from_text(json_text)
        
        # Handle text responses
        if not is_valid_json or "textResponse" in parsed_json:
            text = parsed_json.get("textResponse", json_text)
            return JSONResponse(content=create_text_response(text))
        
        # Process data response - classify dimensions
        agg_def = AggregationDefinition(**parsed_json)
        time_dim, geo_dim, cat_dim = classify_dimensions(agg_def.dimensions)
        agg_def = agg_def.copy(update={
            "timeDimension": time_dim,
            "geoDimension": geo_dim,
            "categoricalDimension": cat_dim
        })
        
        # Generate and execute SQL query
        sql = generate_sql(agg_def, "requests_311", user_location)
        dataset, query_metadata = execute_sql_in_duckDB(sql, DUCKDB_FILE)
        
        # Add date range to aggregation definition
        if 'createdDateRange' in query_metadata:
            agg_def.createdDateRange = query_metadata['createdDateRange']
        
        # Check for single dimension optimization condition
        if (
            not is_topn_query(agg_def) and                   # Not TopN Query
            len(agg_def.dimensions) == 1 and                 # Only one dimension
            agg_def.preAggregationFilters and                # Has preAggregation filters
            len(dataset) == 1                                # Result is only one row
        ):
            dimension = agg_def.dimensions[0]
            
            # Skip complex filters with logical operators
            if " AND " in agg_def.preAggregationFilters.upper() or " OR " in agg_def.preAggregationFilters.upper():
                logger.info(f"[{request_id}] Skipping dimension optimization - complex filter detected")
            else:
                # Simple dimension = 'value' pattern
                pattern = rf"\b{re.escape(dimension)}\s*=\s*'[^']*'"
                
                if re.search(pattern, agg_def.preAggregationFilters, re.IGNORECASE):
                    logger.info(f"[{request_id}] Detected redundant dimension filter: {dimension}")
                    
                    # Simply remove the entire filter since it's the only one
                    modified_filters = ""
                    agg_def = agg_def.copy(update={"preAggregationFilters": modified_filters})
                    sql = generate_sql(agg_def, "requests_311", user_location)
                    dataset, query_metadata = execute_sql_in_duckDB(sql, DUCKDB_FILE)
                    
                    if 'createdDateRange' in query_metadata:
                        agg_def.createdDateRange = query_metadata['createdDateRange']
        
        # Process results and optimize dimensions
        dimension_stats = {}
        if dataset and agg_def.dimensions:
            dimension_stats = calculate_dimension_cardinality_stats(dataset, agg_def.dimensions)
            agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)
        
        # Determine best visualization
        if len(dataset) == 0:
            available_charts = ['text']
            ideal_chart = 'text'
        else:
            available_charts, ideal_chart = get_chart_options(agg_def, dimension_stats)

        # Add field metadata
        all_field_description = (
            data_schema["dimensions"]["time_dimension"] + 
            data_schema["dimensions"]["geo_dimension"] + 
            data_schema["dimensions"]["categorical_dimension"] + 
            data_schema["measures"]
        )

        field_metadata = []
        fields = agg_def.dimensions + [field["alias"] for field in agg_def.measures]

        for field in fields:
            for field_description in all_field_description:
                if field_description["physical_name"] == field:
                    field_description = field_description.copy()
                    field_description.pop("synonym", None)
                    field_metadata.append(field_description)
        
        # Add datasource metadata
        datasource_metadata = []
        used_datasources = set(field['data_source_id'] for field in field_metadata)
        
        for used_datasource in used_datasources:
            for datasource in data_schema["data_sources"]:
                if datasource["data_source_id"] == used_datasource:
                    datasource_metadata.append(datasource)

        agg_def = agg_def.copy(update={
            "datasourceMetadata": datasource_metadata,
            "fieldMetadata": field_metadata
        })
            
        # Build response - add schema metadata for frontend
        response_payload = {
            "dataset": dataset,
            "fields": fields,
            "sql": sql,
            "aggregationDefinition": agg_def.dict(),
            "chartType": ideal_chart,
            "availableChartTypes": available_charts,
            "dimensionStats": dimension_stats,
            "textResponse": None,
            "dataMetadataAll": data_schema,
        }

        # Add data description
        data_description = generate_data_description(
            original_query=request_data.prompt, 
            dataset=dataset,
            aggregation_definition=agg_def.dict(),
            chart_type=ideal_chart
        )

        response_payload["dataInsights"] = {
            "title": data_description.get("title"),
            "dataDescription": data_description.get("dataDescription"),
            "filter_description": data_description.get("filter_description")
        }
        
        logger.info(f"[{request_id}] Completed in {time.time() - start_time:.2f}s")
        return JSONResponse(content=response_payload)
        
    except Exception as error:
        logger.exception(f"[{request_id}] Error processing prompt")
        return JSONResponse(status_code=500, content={"error": str(error)})
