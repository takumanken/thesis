"""
NYC 311 Data Explorer API

This API processes natural language queries about NYC 311 data, translating them
into SQL queries, executing them, and generating visualizations and insights.
"""

# Standard library imports
import functools
import json
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union
from collections import defaultdict

# Third-party library imports
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.genai import errors as genai_errors
import polars as pl
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Local imports
import query_engine
import text_insights
from models import AggregationDefinition, PromptRequest
from query_translator import translate_query
from visualization_recommender import get_viz_recommendations
from utils import (
    DATA_SCHEMA_FILE, get_gemini_client,
    get_logger, configure_logging, call_gemini_async, gemini_safe
)

# === CONSTANTS ===
ALLOWED_ORIGINS = ["https://takumanken.github.io", "http://127.0.0.1:5500"]
API_RATE_LIMIT = "10/minute"

# === GLOBAL CONFIGURATION ===
# Configure logging
logger = get_logger('api')


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

# --- Response Formatting Helpers ---
def create_text_response(text: str) -> Dict[str, Any]:
    """Creates a standardized text-only response payload."""
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


def get_location_required_response() -> Dict[str, Any]:
    """Return a response for when location services are required but not enabled"""
    return {
        "dataInsights": {
            "title": "Location Services Required",
            "dataDescription": "This query requires location services to be enabled. Please check 'Use my NYC location'.",
            "filterDescription": []
        }
    }


# --- Request Processing Helpers ---
def extract_query_info(request_data: PromptRequest) -> Dict[str, Any]:
    """Extract query, context, and location information from request"""
    user_location = None
    raw_query = request_data.prompt
    context = request_data.context.dict() if request_data.context else None
    
    # Add location info to query if available
    if hasattr(request_data, 'location') and request_data.location:
        user_location = request_data.location
        logger.info("Location data available but masked for privacy")
        raw_query = f"{request_data.prompt}\n[USER_LOCATION_AVAILABLE: TRUE]"
    
    return {
        "raw_query": raw_query,
        "user_location": user_location,
        "context": context
    }


def add_date_range_metadata(agg_def: AggregationDefinition, query_metadata: Dict[str, Any]) -> AggregationDefinition:
    """Add date range from query metadata to aggregation definition"""
    if 'createdDateRange' in query_metadata:
        agg_def = agg_def.copy(update={"createdDateRange": query_metadata['createdDateRange']})
    
    return agg_def


# --- Visualization Classification Helpers ---
def calculate_dimension_cardinality(dataset: List[Dict], dimensions: List[str]) -> Dict[str, int]:
    """
    Calculates total unique values for each dimension using memory-efficient streaming.
    
    Args:
        dataset: List of data dictionaries 
        dimensions: List of dimension names to analyze
        
    Returns:
        Dictionary mapping dimension names to their cardinality
    """
    if not dataset or not dimensions:
        return {}
    
    unique_values = defaultdict(set)
    
    for row in dataset:
        for dim in dimensions:
            if dim in row and row[dim] is not None:
                try:
                    unique_values[dim].add(row[dim])
                except TypeError:
                    pass
    
    # Count unique values for each dimension
    return {dim: len(values) for dim, values in unique_values.items()}


def reorder_dimensions_by_cardinality(agg_def: AggregationDefinition, dimension_stats: Dict[str, int]) -> AggregationDefinition:
    """Reorders dimensions by their cardinality (highest to lowest)."""
    if not agg_def.dimensions or len(agg_def.dimensions) <= 1 or not dimension_stats:
        return agg_def
    
    # Sort dimensions by cardinality (descending)
    sorted_dims = sorted(
        agg_def.dimensions,
        key=lambda dim: dimension_stats.get(dim, 0),
        reverse=True
    )
    
    return agg_def.copy(update={"dimensions": sorted_dims})


def recommend_visualization(agg_def: AggregationDefinition, dimension_stats: Dict[str, int], 
                           dataset_size: int) -> Tuple[List[str], str]:
    """Recommend the best visualization type for the data"""
    if dataset_size == 0:
        return ['text'], 'text'
    
    return get_viz_recommendations(agg_def, dimension_stats, dataset_size)


# --- API Integration Functions ---
@gemini_safe
async def translate_query_safe(raw_query: str, context: Optional[Dict]) -> Union[str, JSONResponse]:
    """Translate natural language query and handle direct responses"""
    translated_query, is_direct_response = await translate_query(raw_query, context)
    
    if is_direct_response:
        logger.info("Returning direct response")
        response_payload = asdict(ResponsePayload())
        response_payload.update(create_text_response(translated_query))
        return JSONResponse(content=response_payload)
    
    return translated_query


@gemini_safe
async def generate_content_safe(model_name: str, prompt: str, **kwargs):
    """Safe wrapper for generate_content that handles API errors"""
    return await call_gemini_async(model_name, prompt, **kwargs)


async def execute_sql_query(translated_query: str, 
                    user_location: Optional[Dict]) -> Union[Dict, JSONResponse]:
    """Execute SQL query based on translated query"""
    # Call the query engine to process the query
    result = await query_engine.process_aggregation_query(
        translated_query=translated_query,
        user_location=user_location,
        generate_content_safe=generate_content_safe
    )
    
    # Handle location required case
    if result.get("locationRequired"):
        response_payload = asdict(ResponsePayload())
        response_payload.update(get_location_required_response())
        return JSONResponse(content=response_payload)
    
    # Handle text response case
    if result.get("textResponse"):
        response_payload = asdict(ResponsePayload())
        response_payload.update(create_text_response(result["textResponse"]))
        return JSONResponse(content=response_payload)
    
    return result


# --- Environment Setup ---
def setup_environment() -> Dict[str, Any]:
    """Load all resources and initialize services"""
    # Load data schema
    with open(DATA_SCHEMA_FILE, "r") as f:
        data_schema = json.load(f)
    
    # Set up API client
    client = get_gemini_client()
    
    return {
        "data_schema": data_schema,
        "client": client
    }


# === APPLICATION SETUP ===
# Load environment variables first
load_dotenv()
configure_logging()

# Create FastAPI app
app = FastAPI()

# Configure middleware
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Initialize environment
resources = setup_environment()
data_schema = resources["data_schema"]
client = resources["client"]
logger.info("Environment setup completed")


# === MAIN API ENDPOINT ===
@app.post("/process")
@limiter.limit(API_RATE_LIMIT)
async def process_prompt(request_data: PromptRequest, request: Request) -> JSONResponse:
    """Process natural language queries about NYC 311 data"""
    logger.info(f"Processing request: {request_data.prompt[:50]}...")
    start_time = time.time()
    
    # Initialize response structure
    response_payload = asdict(ResponsePayload())
    
    try:
        # ---- STEP 1: EXTRACT QUERY INFO ----
        query_info = extract_query_info(request_data)
        raw_query = query_info["raw_query"]
        user_location = query_info["user_location"]
        context = query_info["context"]
        
        # ---- STEP 2: TRANSLATE QUERY ----
        translated_query = await translate_query_safe(raw_query, context)
        if isinstance(translated_query, JSONResponse):
            return translated_query
        
        # ---- STEP 3: EXECUTE SQL QUERY ----
        query_result = await execute_sql_query(translated_query, user_location)
        
        # ---- STEP 4: ANALYZE DATA ----
        # Extract key data from query result
        sql = query_result["sql"]
        dataset = query_result["dataset"]
        agg_def = query_result["aggregationDefinition"]
        query_metadata = query_result["queryMetadata"]

        # Calculate dimension statistics
        dimension_stats = calculate_dimension_cardinality(dataset, agg_def.dimensions)

        # Update aggregation definition
        agg_def = add_date_range_metadata(agg_def, query_metadata)
        agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)

        # Recommend visualization
        available_charts, ideal_chart = recommend_visualization(
            agg_def, dimension_stats, len(dataset)
        )
        
        # ---- STEP 5: GENERATE DATA INSIGHTS ----
        insights_result = await text_insights.generate_data_insights_complete(
            request_data.prompt,
            dataset,
            agg_def,
            ideal_chart,
            query_metadata,
            data_schema
        )
        
        # Extract results
        data_insights = insights_result["dataInsights"]
        agg_def = insights_result["enhancedAggDef"]
        
        # ---- STEP 6: BUILD RESPONSE ----
        response_payload.update({
            "sql": sql,
            "dataset": dataset,
            "fields": agg_def.dimensions + [field["alias"] for field in agg_def.measures],
            "chartType": ideal_chart,
            "availableChartTypes": available_charts,
            "dimensionStats": dimension_stats,
            "aggregationDefinition": agg_def.dict(),
            "dataMetadataAll": data_schema,
            "dataInsights": data_insights
        })
        
        logger.info(f"Completed in {time.time() - start_time:.2f}s")
        return JSONResponse(content=response_payload)
        
    except HTTPException as http_error:
        logger.error(f"HTTP error: {http_error.status_code} - {http_error.detail}")
        error_message = (
            http_error.detail.get("error") 
            if isinstance(http_error.detail, dict) 
            else "An error occurred"
        )
        
        return JSONResponse(
            status_code=http_error.status_code,
            content={
                "error": error_message,
                "errorType": "api_error",
                "success": False
            }
        )
    except Exception as error:
        logger.exception("Error processing prompt")
        return JSONResponse(
            status_code=500, 
            content={
                "error": "An error occurred while processing your request",
                "errorType": "server_error",
                "success": False
            }
        )