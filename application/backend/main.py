import logging
import os
import json
import time
import uuid
import duckdb
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from google import genai
from google.genai import types
from typing import List, Dict, Tuple, Optional, Any
import polars as pl
import numpy as np
from data_description import generate_data_description

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
SYSTEM_INSTRUCTION_FILE = "system_instruction.txt"
FILTER_VALUES_DIR = "filter_values"
TIME_DIMENSIONS = [
    "created_week", "closed_week", "created_date", "closed_date",
    "created_month", "closed_month", "created_year", "closed_year",
    "created_year_datepart", "created_month_datepart", "created_day_datepart",
    "created_hour_datepart", "closed_year_datepart", "closed_month_datepart", 
    "closed_day_datepart", "closed_hour_datepart"
]
GEO_DIMENSIONS = ["borough", "county", "location", "incident_zip", "neighborhood_name"]
ADDITIVE_MEASURES = ["num_of_requests"]

# Data models
class PromptRequest(BaseModel):
    """
    Request model for the /process endpoint.
    Contains the user's prompt text and optional location data.
    """
    prompt: str
    location: Optional[Dict[str, float]] = None

class AggregationDefinition(BaseModel):
    """
    Defines the structure of a data aggregation query.
    Contains dimensions, measures, and filters for aggregation operations.
    """
    dimensions: List[str]
    measures: List[Dict[str, str]]
    preAggregationFilters: str = ""
    postAggregationFilters: str = ""
    timeDimension: List[str] = []
    geoDimension: List[str] = []
    categoricalDimension: List[str] = []
    response_type: str = "data"

# Environment setup
def setup_environment():
    """
    Loads system instructions and initializes the Gemini API client.
    
    Returns:
        Tuple containing the formatted system instruction and initialized API client.
    """
    with open(SYSTEM_INSTRUCTION_FILE, "r") as f:
        system_instruction = f.read()

    with open(os.path.join(FILTER_VALUES_DIR, "all_filters.json"), "r") as f:
        all_filters = json.load(f)
        
    # Replace the {all_filters} placeholder 
    system_instruction = system_instruction.replace("{all_filters}", json.dumps(all_filters))
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable not set")
        raise ValueError("GEMINI_API_KEY is required")
        
    return system_instruction, genai.Client(api_key=api_key)

system_instruction, client = setup_environment()
logger.info("Environment setup completed")

# Helper functions
def classify_dimensions(dimensions: list[str]) -> tuple[list[str], list[str], list[str]]:
    """
    Categorizes dimensions into time, geographic, and categorical types.
    
    Args:
        dimensions: List of dimension names to classify
        
    Returns:
        Tuple of (time_dimensions, geo_dimensions, categorical_dimensions)
    """
    time_dim = [dim for dim in dimensions if dim in TIME_DIMENSIONS]
    geo_dim = [dim for dim in dimensions if dim in GEO_DIMENSIONS]
    cat_dim = [dim for dim in dimensions if dim not in time_dim]
    return time_dim, geo_dim, cat_dim

def is_measure_additive(measure_alias: str) -> bool:
    """
    Determines if a measure can be summed (is additive).
    
    Args:
        measure_alias: The alias of the measure to check
        
    Returns:
        True if the measure is additive, False otherwise
    """
    return measure_alias in ADDITIVE_MEASURES

def all_dimensions_exceed_cardinality(dimensions: list[str], dimension_stats: Dict[str, Dict[str, float]], threshold: int = 15) -> bool:
    """
    Checks if all non-time dimensions exceed the cardinality threshold.
    Used to determine if certain visualizations are suitable.
    
    Args:
        dimensions: List of dimensions to check
        dimension_stats: Statistics about each dimension's cardinality
        threshold: Maximum acceptable cardinality (default: 15)
        
    Returns:
        True if all dimensions exceed the threshold, False otherwise
    """
    if not dimensions or not dimension_stats:
        return False
        
    non_time_dims = [dim for dim in dimensions if dim not in TIME_DIMENSIONS]
    if not non_time_dims:
        return False
        
    for dim in non_time_dims:
        if dim not in dimension_stats:
            continue
        
        cardinality = dimension_stats[dim].get("total_unique", 0)
        if cardinality <= threshold:
            return False
            
    return True

def get_chart_options(agg_def: AggregationDefinition, dimension_stats: Dict[str, Dict[str, float]] = None) -> tuple[list[str], str]:
    """
    Determines available and ideal chart types based on the aggregation definition.
    
    Args:
        agg_def: The aggregation definition containing dimensions and measures
        dimension_stats: Statistics about dimension cardinality (optional)
        
    Returns:
        Tuple of (available_chart_types, ideal_chart_type)
    """
    available = ["table"]
    ideal = "table"
    
    dimensions = agg_def.dimensions or []
    measures = agg_def.measures or []
    
    time_dim, geo_dim, cat_dim = classify_dimensions(dimensions)
    dim_count = len(dimensions)
    time_count = len(time_dim)
    geo_count = len(geo_dim)
    cat_count = len(cat_dim)
    measure_count = len(measures)
    
    additive_measure_count = sum(is_measure_additive(m["alias"]) for m in measures) if measures else 0
    
    # Check for text response type first
    if hasattr(agg_def, 'response_type') and agg_def.response_type == "text":
        return ["text"], "text"
    
    # Empty data check
    if not dimensions and not measures:
        return available, ideal
    
    high_cardinality = dimension_stats and all_dimensions_exceed_cardinality(dimensions, dimension_stats)
    
    # Add chart types based on data characteristics
    if dim_count == 1 and measure_count == 1 and time_count == 0:
        available.append("single_bar_chart")
    
    if time_count == 1 and cat_count <= 1 and measure_count == 1 and not high_cardinality:
        available.append("line_chart")
    
    if time_count == 1 and cat_count == 1 and measure_count == 1 and additive_measure_count == measure_count and not high_cardinality:
        available.append("stacked_area_chart")
        available.append("stacked_area_chart_100")
    
    if 1 <= cat_count <= 2 and 1 <= measure_count <= 2 and (cat_count > 1 or measure_count > 1):
        available.append("nested_bar_chart")
    
    if cat_count == 2 and measure_count == 1 and not high_cardinality:
        available.append("grouped_bar_chart")
    
    if cat_count == 2 and measure_count == 1 and additive_measure_count == measure_count and not high_cardinality:
        available.append("stacked_bar_chart")
        available.append("stacked_bar_chart_100")
    
    if 1 <= cat_count <= 2 and measure_count == 1 and time_count == 0 and additive_measure_count == measure_count:
        if cat_count < 2 or not high_cardinality:
            available.append("treemap")
    
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1 and additive_measure_count == measure_count:
        geo_name = geo_dim[0].lower()
        if "location" in geo_name:
            available.append("heat_map")
    
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1 and additive_measure_count == measure_count:
        geo_name = geo_dim[0].lower()
        if any(area in geo_name for area in ["borough", "county", "neighborhood"]):
            available.append("choropleth_map")
    
    # Select ideal chart based on hierarchical rules
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1 and additive_measure_count == measure_count:
        geo_name = geo_dim[0].lower()
        if "location" in geo_name:
            ideal = "heat_map"
        elif any(area in geo_name for area in ["borough", "county", "neighborhood"]):
            ideal = "choropleth_map"
    
    elif time_count == 1 and cat_count <= 1 and measure_count == 1:
        ideal = "line_chart"
        if cat_count == 1 and additive_measure_count == measure_count:
            ideal = "stacked_area_chart"
    
    else:
        if dim_count == 1 and measure_count == 1 and time_count == 0:
            ideal = "single_bar_chart"
        elif 1 <= cat_count <= 2 and 1 <= measure_count <= 2 and (cat_count + measure_count) <= 4:
            ideal = "nested_bar_chart"
        elif cat_count == 2 and measure_count == 1:
            ideal = "grouped_bar_chart"
    
    # Handle high cardinality charts
    if high_cardinality:
        restricted_charts = ["line_chart", "stacked_area_chart", "stacked_area_chart_100", 
                            "grouped_bar_chart", "stacked_bar_chart", "stacked_bar_chart_100"]
        
        if cat_count == 2:
            restricted_charts.append("treemap")
            
        if ideal in restricted_charts:
            ideal = "table"
    
    # Ensure unique chart types
    available = list(dict.fromkeys(available))
    logger.info(f"Chart options: {available}, ideal: {ideal}")
    return available, ideal

def generate_sql(definition: AggregationDefinition, table_name: str, user_location: Optional[Dict[str, float]] = None) -> str:
    """
    Generates a SQL query from an aggregation definition.
    
    Args:
        definition: The aggregation definition with dimensions, measures and filters
        table_name: Name of the table to query
        user_location: Optional user location data for proximity queries
        
    Returns:
        Complete SQL query string ready to execute
    """
    start_time = time.time()

    # Build SELECT clause
    dims = definition.dimensions
    dims_clause = ", ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    select_clause = f"{dims_clause}, {measures_clause}" if dims_clause and measures_clause else (dims_clause or measures_clause)
    
    sql = f"SELECT {select_clause} FROM {table_name}"
    
    # Add filters with location placeholders if needed
    if definition.preAggregationFilters:
        filters = definition.preAggregationFilters
        
        if user_location and ("{{user_latitude}}" in filters or "{user_latitude}" in filters):
            logger.info(f"Location placeholders found in filters, substituting with: lat={user_location.get('latitude'):.6f}, lng={user_location.get('longitude'):.6f}")
            logger.info(f"Original filters: {filters}")
            
            for placeholder, replacement in [
                ("{{user_latitude}}", str(user_location.get('latitude'))),
                ("{{user_longitude}}", str(user_location.get('longitude'))),
                ("{user_latitude}", str(user_location.get('latitude'))),
                ("{user_longitude}", str(user_location.get('longitude')))
            ]:
                filters = filters.replace(placeholder, replacement)
            
            logger.info(f"Filters after substitution: {filters}")
        
        sql += f" WHERE {filters}"
    
    # Add grouping if dimensions exist
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f" GROUP BY {group_clause}"
    
    # Add post-aggregation filters (HAVING)
    if definition.postAggregationFilters:
        sql += f" HAVING {definition.postAggregationFilters}"
    
    # Add ordering
    if definition.timeDimension:
        sql += f" ORDER BY {definition.timeDimension[0]} ASC"
    elif definition.measures:
        sql += f" ORDER BY {definition.measures[0]['alias']} DESC"
    
    sql += " LIMIT 1000;"
    
    logger.info(f"SQL generation completed in {time.time() - start_time:.2f}s")
    logger.info(f"Generated SQL:\n{sql}")
    return sql.strip()

def execute_sql_in_duckDB(sql: str, db_filename: str) -> list:
    """
    Executes a SQL query in DuckDB and returns the results.
    
    Args:
        sql: The SQL query string to execute
        db_filename: Database filename (or :memory: for in-memory database)
        
    Returns:
        Query results as a list of dictionaries (JSON-serializable)
        
    Raises:
        Various exceptions if the query fails
    """
    start_time = time.time()
    logger.info(f"Executing SQL query in DuckDB:\n    {sql}")
    
    try:
        with duckdb.connect(":memory:") as con:
            # Setup spatial extensions
            con.execute("INSTALL spatial;")
            con.execute("LOAD spatial;")
            
            # Create view from SQL file
            with open("duckdb/requests_311.sql", "r") as f:
                view_sql = f.read()
            
            view_sql = view_sql.format(object_name="requests_311")
            con.execute(view_sql)
            
            # Execute the query
            df = con.execute(sql).fetchdf()
            row_count = len(df)
            logger.info(f"Query executed successfully: {row_count} rows returned")
    except Exception as e:
        logger.error(f"Database query failed: {str(e)}")
        logger.error(f"SQL with error:\n{sql}")
        raise
    
    # Format datetime columns for JSON serialization
    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
    
    logger.info(f"SQL execution completed in {time.time() - start_time:.2f}s")
    return json.loads(df.to_json(orient="records"))

def calculate_dimension_cardinality_stats(dataset: List[Dict], dimensions: List[str]) -> Dict[str, Dict[str, float]]:
    """
    Calculates cardinality statistics for each dimension in the dataset.
    
    Args:
        dataset: The query results as a list of dictionaries
        dimensions: List of dimension names to analyze
        
    Returns:
        Dictionary mapping each dimension to its cardinality statistics
    """
    if not dataset or not dimensions:
        return {}
    
    # Convert to Polars DataFrame for better performance
    try:
        df = pl.DataFrame(dataset)
    except Exception as e:
        logger.warning(f"Failed to use Polars: {str(e)}. Using pandas.")
        import pandas as pd
        df = pd.DataFrame(dataset)
    
    stats = {}
    
    # Calculate stats for each dimension
    for dim in dimensions:
        if dim not in df.columns:
            continue
            
        total_unique = df[dim].n_unique()
        
        # Handle single dimension case
        if len(dimensions) == 1:
            stats[dim] = {
                "total_unique": total_unique,
                "min_per_group": total_unique,
                "max_per_group": total_unique,
                "avg_per_group": float(total_unique),
                "median_per_group": float(total_unique),
                "std_per_group": 0.0
            }
            continue
        
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
        stats[dim] = {
            "total_unique": int(total_unique),
            "min_per_group": int(np.min(unique_counts)),
            "max_per_group": int(np.max(unique_counts)),
            "avg_per_group": float(np.mean(unique_counts)),
            "median_per_group": float(np.median(unique_counts)),
            "std_per_group": float(np.std(unique_counts)),
            "group_count": len(unique_counts)
        }
    
    return stats

def reorder_dimensions_by_cardinality(agg_def: AggregationDefinition, dimension_stats: Dict[str, Dict[str, float]]) -> AggregationDefinition:
    """
    Reorders dimensions by their cardinality (highest to lowest).
    This improves visualization by placing high-cardinality dimensions first.
    
    Args:
        agg_def: The aggregation definition
        dimension_stats: Dictionary of dimension statistics
        
    Returns:
        Updated aggregation definition with reordered dimensions
    """
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

def create_text_response(text: str) -> dict:
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

def extract_json_from_text(json_text: str) -> tuple[dict, bool]:
    """
    Extracts and parses JSON from text content, handling code blocks.
    
    Args:
        json_text: Text content that may contain JSON
        
    Returns:
        Tuple of (parsed_json, is_valid_json)
    """
    is_json = json_text.strip().startswith("{") or "```json" in json_text
    
    if not is_json:
        return {}, False
    
    # Clean up JSON formatting if it's in a code block
    if "```json" in json_text:
        json_text = json_text.split("```json")[1].split("```")[0].strip()
    
    try:
        parsed_json = json.loads(json_text)
        return parsed_json, True
    except json.JSONDecodeError:
        return {}, False

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
            config=types.GenerateContentConfig(system_instruction=system_instruction),
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
        dataset = execute_sql_in_duckDB(sql, ":memory:")
        
        # Process results and optimize dimensions
        dimension_stats = {}
        if dataset and agg_def.dimensions:
            dimension_stats = calculate_dimension_cardinality_stats(dataset, agg_def.dimensions)
            agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)
        
        # Determine best visualization
        available_charts, ideal_chart = get_chart_options(agg_def, dimension_stats)
        
        # Build response
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

        # Add data description (new code)
        if dataset:
            data_description = generate_data_description(
                original_query=request_data.prompt, 
                dataset=dataset,
                aggregation_definition=agg_def.dict(),
                chart_type=ideal_chart
            )
            response_payload["dataDescription"] = data_description.get("dataDescription")
            response_payload["directAnswer"] = data_description.get("directAnswer")
        
        logger.info(f"[{request_id}] Completed in {time.time() - start_time:.2f}s")
        return JSONResponse(content=response_payload)
        
    except Exception as error:
        logger.exception(f"[{request_id}] Error processing prompt")
        return JSONResponse(status_code=500, content={"error": str(error)})
