import logging
import os
import time
import uuid
import json
from typing import Dict, Optional, Tuple, Any, List

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
from query_translator import translate_query

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Define base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Constants with absolute paths
SYSTEM_INSTRUCTION_FILE = os.path.join(BASE_DIR, "gemini_instructions/data_aggregation_instruction.md")
FILTER_VALUES_FILE = os.path.join(BASE_DIR, "gemini_instructions/references/all_filters.json")
DATA_SCHEMA_FILE = os.path.join(BASE_DIR, "data/data_schema.json")
DUCKDB_FILE = os.path.join(BASE_DIR, "data/nyc_open_data_explorer.duckdb")

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


def collect_metadata(fields: List[str]) -> Tuple[List[Dict], List[Dict]]:
    """Collect metadata for fields and their data sources"""
    # Get all field descriptions
    all_field_descriptions = (
        data_schema["dimensions"]["time_dimension"] + 
        data_schema["dimensions"]["geo_dimension"] + 
        data_schema["dimensions"]["categorical_dimension"] + 
        data_schema["measures"]
    )

    # Match field metadata
    field_metadata = []
    for field in fields:
        for field_description in all_field_descriptions:
            if field_description["physical_name"] == field:
                field_desc_copy = field_description.copy()
                field_desc_copy.pop("synonym", None)
                field_metadata.append(field_desc_copy)
    
    # Identify and collect data source metadata
    used_datasources = set(field['data_source_id'] for field in field_metadata if 'data_source_id' in field)
    
    datasource_metadata = []
    for used_datasource in used_datasources:
        for datasource in data_schema["data_sources"]:
            if datasource["data_source_id"] == used_datasource:
                datasource_metadata.append(datasource)
                
    return field_metadata, datasource_metadata


def extract_filter_fields(data_description: Dict[str, Any]) -> List[str]:
    """Extract field names from filter descriptions"""
    filter_fields = []
    if data_description.get("filterDescription"):
        for filter_desc in data_description.get("filterDescription", []):
            if isinstance(filter_desc, dict) and "filteredFieldName" in filter_desc:
                filter_fields.append(filter_desc["filteredFieldName"])
    return filter_fields


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
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Processing new request")
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
            logger.info(f"[{request_id}] Location data available but masked for privacy")
            raw_query = f"{request_data.prompt}\n[USER_LOCATION_AVAILABLE: TRUE]"

        # Step 1: Get translator response - wrap in try/except for early error catching
        try:
            response_text, is_direct_response = translate_query(raw_query, context)
        except genai.errors.ClientError as error:
            # Handle errors immediately and return
            return handle_api_error(error, request_id)
            
        # CASE 1: Direct text response from translator
        if is_direct_response:
            logger.info(f"[{request_id}] Returning direct response from query translator")
            response_payload.update(create_text_response(response_text))
            return JSONResponse(content=response_payload)
        
        # Step 2: Call Gemini API - wrap in try/except for early error catching
        try:
            # Call Gemini API to process the prompt
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0),
                contents=[response_text],
            )
        except genai.errors.ClientError as error:
            # Handle errors immediately and return
            return handle_api_error(error, request_id)
            
        # Continue with processing...
        
        # Step 3: Generate data description - wrap in try/except if it makes API calls
        try:
            data_description = generate_data_description(
                original_query=request_data.prompt, 
                dataset=dataset,
                aggregation_definition=descriptor_agg_def,
                chart_type=ideal_chart
            )
        except genai.errors.ClientError as error:
            # Handle errors immediately and return
            return handle_api_error(error, request_id)
        
        # Complete processing and return response
        response_payload["dataInsights"] = {
            "title": data_description.get("title"),
            "dataDescription": data_description.get("dataDescription"),
            "filterDescription": data_description.get("filterDescription", [])
        }
        
        logger.info(f"[{request_id}] Completed in {time.time() - start_time:.2f}s")
        return JSONResponse(content=response_payload)
        
    except Exception as error:
        # Catch-all for other errors
        logger.exception(f"[{request_id}] Error processing prompt")
        return JSONResponse(
            status_code=500, 
            content={"error": "An error occurred while processing your request"}
        )

# Helper function to handle API errors
def handle_api_error(error, request_id):
    if hasattr(error, 'status_code') and error.status_code == 429:
        logger.warning(f"[{request_id}] Rate limit exceeded")
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded"}
        )
    else:
        status_code = getattr(error, 'status_code', 500)
        logger.error(f"[{request_id}] API error: {error}")
        return JSONResponse(
            status_code=status_code,
            content={"error": "API error", "message": str(error)}
        )
