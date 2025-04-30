import logging
import os
import time
import uuid
import json
from typing import Dict, Optional, Tuple, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Local imports
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
from query_translator import translate_query

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constants
SYSTEM_INSTRUCTION_FILE = "gemini_instructions/data_aggregation_instruction.md"
FILTER_VALUES_FILE = "gemini_instructions/references/all_filters.json"
DATA_SCHEMA_FILE = "data/data_schema.json"
DUCKDB_FILE = "data/nyc_open_data_explorer.duckdb"

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

# Load data schema
with open(DATA_SCHEMA_FILE, "r") as f:
    data_schema = json.load(f)


def get_simplified_schema() -> Dict[str, Any]:
    """Create a simplified schema without description_to_user fields"""
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
    
    return simplified_schema


def setup_environment() -> Tuple[str, genai.Client]:
    """Load instructions and initialize the Gemini API client"""
    with open(SYSTEM_INSTRUCTION_FILE, "r") as f:
        system_instruction = f.read()

    # Load filter values
    with open(FILTER_VALUES_FILE, "r") as f:
        all_filters = json.load(f)
    
    # Get simplified schema
    simplified_schema = get_simplified_schema()
                
    # Replace the placeholders
    system_instruction = system_instruction.replace("{all_filters}", json.dumps(all_filters))
    system_instruction = system_instruction.replace("{data_schema}", json.dumps(simplified_schema))
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable not set")
        raise ValueError("GEMINI_API_KEY is required")
        
    return system_instruction, genai.Client(api_key=api_key)


def extract_filter_fields(data_description: Dict[str, Any]) -> list:
    """Extract field names from filter descriptions"""
    filter_fields = []
    if data_description.get("filterDescription"):
        for filter_desc in data_description.get("filterDescription", []):
            if isinstance(filter_desc, dict) and "filteredFieldName" in filter_desc:
                filter_fields.append(filter_desc["filteredFieldName"])
    return filter_fields


def collect_field_metadata(fields: list) -> Tuple[list, set]:
    """Collect metadata for all fields and their data sources"""
    # Combine all field descriptions
    all_field_description = (
        data_schema["dimensions"]["time_dimension"] + 
        data_schema["dimensions"]["geo_dimension"] + 
        data_schema["dimensions"]["categorical_dimension"] + 
        data_schema["measures"]
    )

    # Collect metadata
    field_metadata = []
    for field in fields:
        for field_description in all_field_description:
            if field_description["physical_name"] == field:
                field_description = field_description.copy()
                field_description.pop("synonym", None)
                field_metadata.append(field_description)
    
    # Identify data sources
    used_datasources = set(field['data_source_id'] for field in field_metadata if 'data_source_id' in field)
    
    return field_metadata, used_datasources


def collect_datasource_metadata(used_datasources: set) -> list:
    """Collect metadata for all used data sources"""
    datasource_metadata = []
    for used_datasource in used_datasources:
        for datasource in data_schema["data_sources"]:
            if datasource["data_source_id"] == used_datasource:
                datasource_metadata.append(datasource)
    return datasource_metadata


def get_location_required_response() -> Dict[str, Any]:
    """Return a response for when location services are required but not enabled"""
    return {
        "dataInsights": {
            "title": "Location Services Required",
            "dataDescription": "This query requires location services to be enabled. Please check 'Use my NYC location'.",
            "filterDescription": []
        }
    }


def initialize_response() -> Dict[str, Any]:
    """Initialize the response payload with default values"""
    return {
        "chartType": "text",
        "availableChartTypes": ["text"],
        "textResponse": None,
        "dataset": [],
        "fields": [],
        "sql": "",
        "aggregationDefinition": None,
        "dimensionStats": {},
        "dataInsights": {
            "title": None,
            "dataDescription": None,
            "filterDescription": []
        },
        "dataMetadataAll": None
    }


# Initialize environment
system_instruction, client = setup_environment()
logger.info("Environment setup completed")


@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    """Process natural language queries about NYC 311 data"""
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Processing: '{request_data.prompt[:50]}...'")
    start_time = time.time()
    
    # Initialize response structure
    response_payload = initialize_response()
    
    try:
        # Process location data if available
        user_location = None
        raw_query = request_data.prompt
        context = request_data.context.dict() if request_data.context else None
        
        if hasattr(request_data, 'location') and request_data.location:
            user_location = request_data.location
            logger.info(f"[{request_id}] Location: lat={user_location.get('latitude'):.6f}, lng={user_location.get('longitude'):.6f}")
            raw_query = f"{request_data.prompt}\n[USER_LOCATION_AVAILABLE: TRUE]"

        # Get translator response
        response_text, is_direct_response = translate_query(raw_query, context)
        
        # CASE 1: Direct text response from translator
        if is_direct_response:
            logger.info(f"[{request_id}] Returning direct response from query translator")
            response_payload.update(create_text_response(response_text))
        
        # CASE 2: Data aggregation flow
        else:
            # Prepare for Gemini call
            gemini_model = "gemini-2.0-flash"
            prompt = response_text
            logger.info(f"[{request_id}] Prompt: {prompt}")

            # Call Gemini API to process the prompt
            response = client.models.generate_content(
                model=gemini_model,
                config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0),
                contents=[prompt],
            )
            
            # Parse the AI response
            json_text = response.candidates[0].content.parts[0].text
            parsed_json, is_valid_json = extract_json_from_text(json_text)
            
            # CASE 2A: Text response from aggregation AI
            if not is_valid_json or "textResponse" in parsed_json:
                text = parsed_json.get("textResponse", json_text)
                response_payload.update(create_text_response(text))
            
            # CASE 2B: Data visualization response
            else:
                # Process data response - classify dimensions
                agg_def = AggregationDefinition(**parsed_json)
                time_dim, geo_dim, cat_dim = classify_dimensions(agg_def.dimensions)
                agg_def = agg_def.copy(update={
                    "timeDimension": time_dim,
                    "geoDimension": geo_dim,
                    "categoricalDimension": cat_dim
                })
                
                # Generate SQL query
                sql = generate_sql(agg_def, "requests_311", user_location)
                response_payload["sql"] = sql

                # CASE 2B-1: Location check
                location_enabled = bool(user_location)
                if ('user_latitude' in sql or 'user_longitude' in sql) and not location_enabled:
                    logger.info(f"[{request_id}] Query requires location services but they are disabled")
                    response_payload.update(get_location_required_response())
                
                # CASE 2B-2: Normal data execution
                else:
                    # Execute the query
                    dataset, query_metadata = execute_sql_in_duckDB(sql, DUCKDB_FILE)
                    response_payload["dataset"] = dataset
                    
                    # Add date range to aggregation definition
                    if 'createdDateRange' in query_metadata:
                        agg_def.createdDateRange = query_metadata['createdDateRange']
                    
                    # Process dimension statistics and optimize dimensions
                    dimension_stats = {}
                    if dataset and agg_def.dimensions:
                        dimension_stats = calculate_dimension_cardinality_stats(dataset, agg_def.dimensions)
                        agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)
                    
                    response_payload["dimensionStats"] = dimension_stats
                    
                    # Determine best visualization
                    if len(dataset) == 0:
                        available_charts = ['text']
                        ideal_chart = 'text'
                    else:
                        available_charts, ideal_chart = get_chart_options(agg_def, dimension_stats, len(dataset))

                    response_payload["chartType"] = ideal_chart
                    response_payload["availableChartTypes"] = available_charts

                    # First define fields that will be displayed in table (only dimensions and measures)
                    visible_fields = agg_def.dimensions + [field["alias"] for field in agg_def.measures]
                    
                    # Collect initial metadata
                    field_metadata, used_datasources = collect_field_metadata(visible_fields)
                    datasource_metadata = collect_datasource_metadata(used_datasources)

                    # Create a streamlined aggregation definition for the descriptor
                    descriptor_agg_def = {
                        'dimensions': agg_def.dimensions,
                        'measures': agg_def.measures,
                        'preAggregationFilters': agg_def.preAggregationFilters,
                        'postAggregationFilters': agg_def.postAggregationFilters,
                        'topN': agg_def.topN,
                        'createdDateRange': query_metadata.get('createdDateRange', []),
                        'datasourceMetadata': datasource_metadata,
                        'fieldMetadata': field_metadata,
                        'statistics': query_metadata.get('statistics', {})
                    }
                    
                    # Include topN if it exists
                    if hasattr(agg_def, 'topN') and agg_def.topN:
                        descriptor_agg_def['topN'] = {
                            'orderByKey': agg_def.topN.orderByKey,
                            'topN': agg_def.topN.topN
                        }

                    # Generate data description with the streamlined definition
                    data_description = generate_data_description(
                        original_query=request_data.prompt, 
                        dataset=dataset,
                        aggregation_definition=descriptor_agg_def,
                        chart_type=ideal_chart
                    )

                    # Now extract filter fields from the description
                    filter_fields = extract_filter_fields(data_description)
                    
                    # Set fields in response payload (ONLY dimensions and measures, NO filter fields)
                    response_payload["fields"] = visible_fields
                    
                    # Create metadata list that includes ALL fields including filters
                    all_metadata_fields = visible_fields.copy()
                    for field in filter_fields:
                        if field not in all_metadata_fields:
                            all_metadata_fields.append(field)
                    
                    # Only update metadata if we need to include additional filter fields
                    if len(all_metadata_fields) > len(visible_fields):
                        field_metadata, used_datasources = collect_field_metadata(all_metadata_fields)
                        datasource_metadata = collect_datasource_metadata(used_datasources)
                    
                    # Update aggregation definition with complete metadata
                    agg_def = agg_def.copy(update={
                        "datasourceMetadata": datasource_metadata,
                        "fieldMetadata": field_metadata
                    })
                    
                    # Add to response payload    
                    response_payload["aggregationDefinition"] = agg_def.dict()
                    response_payload["dataMetadataAll"] = data_schema
                    response_payload["dataInsights"] = {
                        "title": data_description.get("title"),
                        "dataDescription": data_description.get("dataDescription"),
                        "filterDescription": data_description.get("filterDescription", [])
                    }
        
        logger.info(f"[{request_id}] Completed in {time.time() - start_time:.2f}s")
        
    except Exception as error:
        logger.exception(f"[{request_id}] Error processing prompt")
        response_payload = {"error": str(error)}
        return JSONResponse(status_code=500, content=response_payload)
    
    # Single return point for all responses
    return JSONResponse(content=response_payload)
