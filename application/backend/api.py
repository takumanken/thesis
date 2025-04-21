import logging
import os
import time
import uuid
import json
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
from visualization_recommender import classify_dimensions, get_chart_options
from query_engine import (
    extract_json_from_text, 
    create_text_response,
    generate_sql, 
    execute_sql_in_duckDB, 
    calculate_dimension_cardinality_stats, 
    reorder_dimensions_by_cardinality
)
from text_insights import generate_data_description

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
SYSTEM_INSTRUCTION_FILE = "assets/gemini_instructions/data_aggregation_instruction.md"
REFERENCE_DIR = "assets/gemini_instructions/references"

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
    with open(os.path.join(REFERENCE_DIR, "all_filters.json"), "r") as f:
        all_filters = json.load(f)
    
    # Load data schema
    with open(os.path.join(REFERENCE_DIR, "data_schema.json"), "r") as f:
        data_schema = json.load(f)
    
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

system_instruction, client = setup_environment()
logger.info("Environment setup completed")

# API endpoint
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    """
    Main endpoint for processing natural language prompts.
    
    Args:
        request_data: The prompt request containing text and optional location
        request: The FastAPI request object
        
    Returns:
        JSONResponse containing either data results or text response
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

        # Call Gemini API to process the prompt
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0),
            contents=[content],
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
        dataset, query_metadata = execute_sql_in_duckDB(sql, ":memory:")
        
        # Add date range to aggregation definition as an array
        if 'createdDateRange' in query_metadata:
            agg_def.createdDateRange = query_metadata['createdDateRange']
        
        # Process results and optimize dimensions
        dimension_stats = {}
        if dataset and agg_def.dimensions:
            dimension_stats = calculate_dimension_cardinality_stats(dataset, agg_def.dimensions)
            agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)
        
        # Determine best visualization
        available_charts, ideal_chart = get_chart_options(agg_def, dimension_stats)
        
        # Build response - remove metadata field
        response_payload = {
            "dataset": dataset,
            "fields": list(dataset[0].keys()) if dataset else [],
            "sql": sql,
            "aggregationDefinition": agg_def.dict(),
            "chartType": ideal_chart,
            "availableChartTypes": available_charts,
            "dimensionStats": dimension_stats,
            "textResponse": None
        }

        # Add data description
        if dataset:
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
