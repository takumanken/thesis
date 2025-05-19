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
import polars as pl
import pandas as pd
import numpy as np

# Local imports
import query_engine
import text_insights
from models import AggregationDefinition, PromptRequest
from query_engine import extract_json_from_text
from query_translator import translate_query
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


def extract_query_info(request_id: str, request_data: PromptRequest) -> Dict[str, Any]:
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


# === ERROR HANDLING ===
def gemini_safe(fn):
    """Decorator for handling Gemini API errors consistently"""
    @functools.wraps(fn)
    def wrapper(request_id, *args, **kwargs):
        try:
            return fn(request_id, *args, **kwargs)
        except genai.errors.ClientError as err:
            logger.error(f"[{request_id}] API error: {err}")
            status = getattr(err, "status_code", 500)
            msg = "Rate limit exceeded" if status == 429 else "API error"
            raise HTTPException(status_code=status, detail={"error": msg})
    return wrapper


# === DIMENSION ANALYSIS FUNCTIONS ===
def _convert_to_dataframe(dataset: List[Dict]) -> Union[pl.DataFrame, pd.DataFrame]:
    """Converts dataset to a DataFrame, using Polars if possible."""
    try:
        return pl.DataFrame(dataset)
    except Exception as e:
        logger.warning(f"Failed to use Polars: {str(e)}. Using pandas.")
        return pd.DataFrame(dataset)


def _calculate_single_dimension_stats(
    df: Union[pl.DataFrame, pd.DataFrame], 
    dim: str, 
    dimensions: List[str]
) -> Dict[str, float]:
    """Calculates statistics for a single dimension."""
    # Handle single dimension case
    if isinstance(df, pl.DataFrame):
        total_unique = df[dim].n_unique()
    else:
        total_unique = df[dim].nunique()
        
    if len(dimensions) == 1:
        return {
            "total_unique": total_unique,
            "min_per_group": total_unique,
            "max_per_group": total_unique,
            "avg_per_group": float(total_unique),
            "median_per_group": float(total_unique),
            "std_per_group": 0.0
        }
        
    # For multiple dimensions, calculate per-group stats
    other_dims = [d for d in dimensions if d != dim]
    
    if isinstance(df, pl.DataFrame):
        grouped = (df
                 .group_by(other_dims)
                 .agg(pl.col(dim).n_unique().alias("unique_count")))
        
        unique_counts = grouped["unique_count"].to_numpy()
    else:
        grouped = df.groupby(other_dims)[dim].nunique().reset_index()
        unique_counts = grouped[dim].values
    
    # Calculate comprehensive statistics
    return {
        "total_unique": int(total_unique),
        "min_per_group": int(np.min(unique_counts)),
        "max_per_group": int(np.max(unique_counts)),
        "avg_per_group": float(np.mean(unique_counts)),
        "median_per_group": float(np.median(unique_counts)),
        "std_per_group": float(np.std(unique_counts)),
        "group_count": len(unique_counts)
    }


def calculate_dimension_cardinality_stats(dataset: List[Dict], dimensions: List[str]) -> Dict[str, Dict[str, float]]:
    """Calculates cardinality statistics for each dimension in the dataset."""
    if not dataset or not dimensions:
        return {}
    
    # Try using Polars first, fall back to pandas if needed
    df = _convert_to_dataframe(dataset)
    
    stats = {}
    for dim in dimensions:
        if dim not in df.columns:
            continue
            
        # Calculate dimension stats
        stats[dim] = _calculate_single_dimension_stats(df, dim, dimensions)
    
    return stats


def reorder_dimensions_by_cardinality(agg_def: AggregationDefinition, dimension_stats: Dict[str, Dict[str, float]]) -> AggregationDefinition:
    """Reorders dimensions by their cardinality (highest to lowest)."""
    if not agg_def.dimensions or len(agg_def.dimensions) <= 1 or not dimension_stats:
        return agg_def
    
    # Sort dimensions by total_unique (descending)
    sorted_dims = sorted(
        agg_def.dimensions,
        key=lambda dim: dimension_stats.get(dim, {}).get("total_unique", 0),
        reverse=True
    )
    
    # Re-classify dimensions after sorting
    time_dim, geo_dim, cat_dim = classify_dimensions(sorted_dims)
    
    return agg_def.copy(update={
        "dimensions": sorted_dims,
        "timeDimension": time_dim,
        "geoDimension": geo_dim,
        "categoricalDimension": cat_dim
    })


# === DATA ANALYSIS FUNCTIONS ===
def calculate_statistics(dataset, agg_def, query_metadata):
    """Calculate statistics and optimize dimensions"""
    # Add date range to aggregation definition if available
    if 'createdDateRange' in query_metadata:
        agg_def.createdDateRange = query_metadata['createdDateRange']
    
    # Process dimension statistics and optimize dimensions
    dimension_stats = {}
    if dataset and agg_def.dimensions:
        dimension_stats = calculate_dimension_cardinality_stats(dataset, agg_def.dimensions)
        agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)
    
    return dimension_stats, agg_def


def recommend_visualization(agg_def, dimension_stats, dataset_size):
    """Recommend the best visualization type for the data"""
    if dataset_size == 0:
        available_charts, ideal_chart = ['text'], 'text'
    else:
        available_charts, ideal_chart = get_chart_options(agg_def, dimension_stats, dataset_size)
    
    return available_charts, ideal_chart


# === WRAPPED API FUNCTIONS ===
@gemini_safe
def translate_query_safe(request_id, raw_query, context):
    """Translate natural language query and handle direct responses"""
    response_text, is_direct_response = translate_query(raw_query, context)
    
    if is_direct_response:
        logger.info(f"[{request_id}] Returning direct response")
        response_payload = asdict(ResponsePayload())
        response_payload.update(create_text_response(response_text))
        return JSONResponse(content=response_payload)
    
    return response_text


@gemini_safe
def generate_content_safe(request_id, *args, **kwargs):
    """Safe wrapper for generate_content that handles API errors"""
    return client.models.generate_content(*args, **kwargs)


# === QUERY PROCESSING FUNCTIONS ===
async def execute_sql_query(request_id, response_text, user_location):
    """
    Execute SQL query based on translated query
    
    Returns:
        - JSONResponse if a special case requires immediate response
        - Dict with query results if processing should continue
    """
    safe_content_generator = lambda *args, **kwargs: generate_content_safe(request_id, *args, **kwargs)
    
    # Call the query engine to process the query
    result = await query_engine.process_aggregation_query(
        response_text=response_text,
        user_location=user_location,
        request_id=request_id,
        system_instruction=system_instruction,
        db_filename=DUCKDB_FILE,
        generate_content_safe=safe_content_generator
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


# === ENVIRONMENT SETUP ===
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
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is required")
        
    return {
        "data_schema": data_schema,
        "system_instruction": system_instruction,
        "client": genai.Client(api_key=api_key)
    }


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
    """Process natural language queries about NYC 311 data"""
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Processing new request")
    start_time = time.time()
    
    # Initialize response structure
    response_payload = asdict(ResponsePayload())
    
    try:
        # ---- STEP 1: EXTRACT QUERY INFO ----
        query_info = extract_query_info(request_id, request_data)
        raw_query = query_info["raw_query"]
        user_location = query_info["user_location"]
        context = query_info["context"]
        
        # ---- STEP 2: TRANSLATE QUERY ----
        translated_query = translate_query_safe(request_id, raw_query, context)
        if isinstance(translated_query, JSONResponse):
            return translated_query
        
        # ---- STEP 3: EXECUTE SQL QUERY ----
        query_result = await execute_sql_query(
            request_id, translated_query, user_location
        )
        if isinstance(query_result, JSONResponse):
            return query_result
        
        # ---- STEP 4: ANALYZE DATA AND GENERATE INSIGHTS ----
        # Extract key components from query result
        sql = query_result["sql"]
        dataset = query_result["dataset"]
        agg_def = query_result["aggregationDefinition"]
        query_metadata = query_result["queryMetadata"]
        
        # Calculate statistics
        dimension_stats, agg_def = calculate_statistics(dataset, agg_def, query_metadata)
        
        # Recommend visualization
        available_charts, ideal_chart = recommend_visualization(
            agg_def, dimension_stats, len(dataset)
        )
        
        # Use the new consolidated function from text_insights
        insights_result = text_insights.generate_data_insights_complete(
            request_id,
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
        
        # ---- STEP 5: BUILD RESPONSE ----
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
        
        logger.info(f"[{request_id}] Completed in {time.time() - start_time:.2f}s")
        return JSONResponse(content=response_payload)
        
    except HTTPException as http_error:
        # Create a clear error message with more details
        logger.error(f"[{request_id}] HTTP error: {http_error.status_code} - {http_error.detail}")
        
        # Construct a consistent error response
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
        # Handle general errors
        logger.exception(f"[{request_id}] Error processing prompt")
        return JSONResponse(
            status_code=500, 
            content={"error": "An error occurred while processing your request"}
        )