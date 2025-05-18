"""
NYC 311 Data Explorer API

This API processes natural language queries about NYC 311 data, translating them
into SQL queries, executing them, and generating visualizations and insights.
"""

# Standard library imports
import functools
import json
import logging
import os
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

# Third-party library imports
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.genai import types
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Local imports
import query_engine
from models import AggregationDefinition, PromptRequest
from query_engine import (
    calculate_dimension_cardinality_stats,
    reorder_dimensions_by_cardinality,
)
from query_translator import translate_query
from text_insights import generate_data_description
from visualization_recommender import classify_dimensions, get_chart_options


# === CONSTANTS ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SYSTEM_INSTRUCTION_FILE = os.path.join(BASE_DIR, "gemini_instructions/data_aggregation_instruction.md")
FILTER_VALUES_FILE = os.path.join(BASE_DIR, "gemini_instructions/references/all_filters.json")
DATA_SCHEMA_FILE = os.path.join(BASE_DIR, "data/data_schema.json")
DUCKDB_FILE = os.path.join(BASE_DIR, "data/nyc_open_data_explorer.duckdb")


# === DATA MODELS ===
@dataclass
class ResponsePayload:
    """Standard response structure for the API"""
    chartType: str = "text"
    availableChartTypes: List[str] = field(default_factory=lambda: ["text"])
    textResponse: Optional[str] = None
    dataset: List = field(default_factory=list)
    fields: List[str] = field(default_factory=list)
    sql: str = ""
    aggregationDefinition: Optional[Dict] = None
    dimensionStats: Dict[str, Any] = field(default_factory=dict)
    dataInsights: Dict[str, Any] = field(
        default_factory=lambda: {
            "title": None,
            "dataDescription": None,
            "filterDescription": [],
        }
    )
    dataMetadataAll: Optional[Dict] = None


# === HELPER FUNCTIONS ===
def get_simplified_schema(data_schema: Dict[str, Any]) -> Dict[str, Any]:
    """Remove description_to_user fields from schema for AI prompt"""
    strip = lambda obj: {k: v for k, v in obj.items() if k != "description_to_user"}

    return {
        "dimensions": {
            dim_type: [strip(dim) for dim in dims]
            for dim_type, dims in data_schema["dimensions"].items()
        },
        "measures": [strip(m) for m in data_schema["measures"]],
    }


def setup_environment() -> Dict[str, Any]:
    """Load all resources and initialize services"""
    # Load data schema
    with open(DATA_SCHEMA_FILE, "r") as f:
        data_schema = json.load(f)
    
    # Load system instructions
    with open(SYSTEM_INSTRUCTION_FILE, "r") as f:
        system_instruction = f.read()
    
    # Load filter values
    with open(FILTER_VALUES_FILE, "r") as f:
        all_filters = json.load(f)
        
    # Generate simplified schema for AI
    simplified_schema = get_simplified_schema(data_schema)
                
    # Replace the placeholders in system instruction
    system_instruction = system_instruction.replace("{all_filters}", json.dumps(all_filters))
    system_instruction = system_instruction.replace("{data_schema}", json.dumps(simplified_schema))
    
    # Set up API client
    api_key = os.getenv("GEMINI_API_KEY")
        
    return {
        "data_schema": data_schema,
        "system_instruction": system_instruction,
        "client": genai.Client(api_key=api_key)
    }


def collect_metadata(fields: List[str], data_schema: Dict[str, Any]) -> Tuple[List[Dict], List[Dict]]:
    """Collect metadata for fields and their associated data sources"""
    # Get all field descriptions from schema
    all_field_descriptions = (
        data_schema["dimensions"]["time_dimension"] + 
        data_schema["dimensions"]["geo_dimension"] + 
        data_schema["dimensions"]["categorical_dimension"] + 
        data_schema["measures"]
    )

    # Match fields to their metadata
    field_metadata = []
    for field in fields:
        for field_description in all_field_descriptions:
            if field_description["physical_name"] == field:
                field_desc_copy = field_description.copy()
                field_desc_copy.pop("synonym", None)  # Remove redundant synonym info
                field_metadata.append(field_desc_copy)
    
    # Build set of unique data source IDs referenced by fields
    used_datasources = set(
        field['data_source_id'] 
        for field in field_metadata 
        if 'data_source_id' in field
    )
    
    # Collect metadata for each data source
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


def create_text_response(text: str) -> Dict[str, Any]:
    """
    Creates a standardized text-only response payload.
    
    Args:
        text: The text content of the response
        
    Returns:
        Response dictionary with text content and null data fields
    """
    return {
        "dataset": [],
        "fields": [],
        "sql": "",
        "aggregationDefinition": {
            "dimensions": [],
            "measures": [],
            "preAggregationFilters": "",
            "postAggregationFilters": "",
            "timeDimension": [],
            "geoDimension": [],
            "categoricalDimension": []
        },
        "chartType": "text",
        "availableChartTypes": ["text"],
        "textResponse": text
    }


def extract_query_info(request_data: PromptRequest, request_id: str) -> Dict[str, Any]:
    """Extract query, context, and location information from request"""
    user_location = None
    raw_query = request_data.prompt
    context = request_data.context.dict() if request_data.context else None
    
    # Add location info to query if available
    if hasattr(request_data, 'location') and request_data.location:
        user_location = request_data.location
        logger.info(f"[{request_id}] Location data available but masked for privacy")
        raw_query = f"{request_data.prompt}\n[USER_LOCATION_AVAILABLE: TRUE]"
    
    return {
        "raw_query": raw_query,
        "user_location": user_location,
        "context": context
    }


# === ERROR HANDLING ===
def gemini_safe(fn):
    """Decorator for handling Gemini API errors consistently"""
    @functools.wraps(fn)
    def wrapper(request_id, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except genai.errors.ClientError as err:
            logger.error(f"[{request_id}] API error: {err}")
            status = getattr(err, "status_code", 500)
            msg = "Rate limit exceeded" if status == 429 else "API error"
            raise HTTPException(status_code=status, detail={"error": msg})
    return wrapper


# === WRAPPED API FUNCTIONS ===
@gemini_safe
def translate_query_safe(*args, **kwargs):
    """Safe wrapper for translate_query that handles API errors"""
    return translate_query(*args, **kwargs)


@gemini_safe
def generate_content_safe(*args, **kwargs):
    """Safe wrapper for generate_content that handles API errors"""
    return client.models.generate_content(*args, **kwargs)


@gemini_safe
def generate_data_description_safe(*args, **kwargs):
    """Safe wrapper for generate_data_description that handles API errors"""
    return generate_data_description(*args, **kwargs)


# === QUERY PROCESSING FUNCTIONS ===
async def generate_data_query(
    response_text: str, 
    user_location: Optional[Dict[str, Any]], 
    request_id: str
) -> Dict[str, Any]:
    """
    Generate data query by calling the query engine
    """
    # Call the query engine to process the query
    result = await query_engine.process_aggregation_query(
        response_text=response_text,
        user_location=user_location,
        request_id=request_id,
        system_instruction=system_instruction,
        db_filename=DUCKDB_FILE,
        generate_content_safe=generate_content_safe
    )
    
    # Handle location required case
    if result.get("locationRequired"):
        return get_location_required_response()
        
    # Handle text response case
    if result.get("textResponse"):
        return create_text_response(result["textResponse"])
        
    return result


def generate_insights(
    query_result: Dict[str, Any], 
    user_location: Optional[Dict[str, Any]], 
    request_id: str, 
    original_query: str
) -> Dict[str, Any]:
    """
    Enhance data results with statistics, visualization recommendations, and insights
    
    This function:
    1. Calculates dataset statistics 
    2. Recommends visualization types
    3. Collects metadata about fields
    4. Generates natural language description
    """
    result = {}
    
    # Extract info from query result
    sql = query_result["sql"] 
    dataset = query_result["dataset"]
    agg_def = query_result["aggregationDefinition"]
    query_metadata = query_result["queryMetadata"]
    
    # Add date range to aggregation definition if available
    if 'createdDateRange' in query_metadata:
        agg_def.createdDateRange = query_metadata['createdDateRange']
    
    # Process dimension statistics and optimize dimensions
    dimension_stats = {}
    if dataset and agg_def.dimensions:
        dimension_stats = calculate_dimension_cardinality_stats(dataset, agg_def.dimensions)
        agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)
    
    result["dimensionStats"] = dimension_stats
    
    # Determine best visualization
    if len(dataset) == 0:
        available_charts, ideal_chart = ['text'], 'text'
    else:
        available_charts, ideal_chart = get_chart_options(agg_def, dimension_stats, len(dataset))
    
    result["chartType"] = ideal_chart
    result["availableChartTypes"] = available_charts
    
    # Define fields that will be displayed in table
    visible_fields = agg_def.dimensions + [field["alias"] for field in agg_def.measures]
    result["fields"] = visible_fields
    
    # Collect metadata for visible fields
    field_metadata, datasource_metadata = collect_metadata(visible_fields, data_schema)
    
    # Create streamlined aggregation definition for the descriptor
    descriptor_agg_def = {
        'dimensions': agg_def.dimensions,
        'measures': agg_def.measures,
        'preAggregationFilters': agg_def.preAggregationFilters,
        'postAggregationFilters': agg_def.postAggregationFilters,
        'topN': getattr(agg_def, 'topN', None),
        'createdDateRange': query_metadata.get('createdDateRange', []),
        'datasourceMetadata': datasource_metadata,
        'fieldMetadata': field_metadata,
        'statistics': query_metadata.get('statistics', {})
    }
    
    # Generate natural language data description
    data_description = generate_data_description_safe(
        request_id,
        original_query=original_query, 
        dataset=dataset,
        aggregation_definition=descriptor_agg_def,
        chart_type=ideal_chart
    )
    
    # Extract filter fields from the description and add their metadata
    filter_fields = extract_filter_fields(data_description)
    all_fields = list(set(visible_fields + filter_fields))
    
    # If we have additional fields from filters, get their metadata too
    if len(all_fields) > len(visible_fields):
        field_metadata, datasource_metadata = collect_metadata(all_fields, data_schema)
    
    # Update aggregation definition with complete metadata
    agg_def = agg_def.copy(update={
        "datasourceMetadata": datasource_metadata,
        "fieldMetadata": field_metadata
    })
    
    # Add to response payload
    result["sql"] = sql
    result["dataset"] = dataset
    result["aggregationDefinition"] = agg_def.dict()
    result["dataMetadataAll"] = data_schema
    result["dataInsights"] = {
        "title": data_description.get("title"),
        "dataDescription": data_description.get("dataDescription"),
        "filterDescription": data_description.get("filterDescription", [])
    }
    
    return result


# === APPLICATION SETUP ===
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

# Initialize environment
resources = setup_environment()
data_schema = resources["data_schema"]
system_instruction = resources["system_instruction"]
client = resources["client"]
logger.info("Environment setup completed")


# === API ENDPOINTS ===
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request) -> JSONResponse:
    """
    Process natural language queries about NYC 311 data
    
    This is the main entry point for the API that:
    1. Extracts query information
    2. Translates the natural language to a structured query
    3. Generates and executes a data query
    4. Enhances results with insights and metadata
    5. Returns formatted response to the client
    """
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Processing new request")
    start_time = time.time()
    
    # Initialize response structure
    response_payload = asdict(ResponsePayload())
    
    try:
        # ---- STEP 1: EXTRACT QUERY INFO ----
        query_info = extract_query_info(request_data, request_id)
        raw_query = query_info["raw_query"]
        user_location = query_info["user_location"]
        context = query_info["context"]
        
        # ---- STEP 2: TRANSLATE QUERY ----
        translation_result = translate_query_safe(request_id, raw_query, context)
        response_text, is_direct_response = translation_result
        
        # If it's a simple question with direct answer, return immediately
        if is_direct_response:
            logger.info(f"[{request_id}] Returning direct response from query translator")
            response_payload.update(create_text_response(response_text))
            return JSONResponse(content=response_payload)
        
        # ---- STEP 3: GENERATE DATA QUERY ----
        query_result = await generate_data_query(
            response_text, user_location, request_id
        )
        
        # If it's a text-only response (no data needed), return immediately
        if query_result.get("textResponse"):
            response_payload.update(query_result)
            return JSONResponse(content=response_payload)
            
        # ---- STEP 4: GENERATE INSIGHTS ----
        insights_result = generate_insights(
            query_result, user_location, request_id, request_data.prompt
        )
        
        # ---- STEP 5: RETURN RESPONSE ----
        response_payload.update(insights_result)
        logger.info(f"[{request_id}] Completed in {time.time() - start_time:.2f}s")
        return JSONResponse(content=response_payload)
        
    except HTTPException as http_error:
        # Handle API errors
        return JSONResponse(
            status_code=http_error.status_code,
            content=http_error.detail
        )
    except Exception as error:
        # Handle general errors
        logger.exception(f"[{request_id}] Error processing prompt")
        return JSONResponse(
            status_code=500, 
            content={"error": "An error occurred while processing your request"}
        )