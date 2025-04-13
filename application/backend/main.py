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

# Enhanced logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize environment and FastAPI app
load_dotenv()
app = FastAPI()

# Configure rate limiting and CORS middleware
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
PUBLIC_BUCKET_URL = "https://pub-cb6e94f4490c42b9b0c520e8116fb9b7.r2.dev/"
DB_FILE_NAME = "nyc_open_data.db"
SYSTEM_INSTRUCTION_FILE = "system_instruction.txt"
FILTER_VALUES_DIR = "filter_values"

# Domain constants
TIME_DIMENSIONS = [
    "created_week", "closed_week", "created_date", "closed_date",
    "created_month", "closed_month", "created_year", "closed_year",
    "created_year_datepart", "created_month_datepart", "created_day_datepart",
    "created_hour_datepart", "closed_year_datepart", "closed_month_datepart", "closed_day_datepart",
    "closed_hour_datepart"
]
GEO_DIMENSIONS = ["borough", "county", "location", "incident_zip", "neighborhood_name"]

# Define additive measures - measures that can be summed
ADDITIVE_MEASURES = ["num_of_requests"]  # Currently only count(1) is additive

# Data models
class PromptRequest(BaseModel):
    prompt: str

class AggregationDefinition(BaseModel):
    dimensions: List[str]
    measures: List[Dict[str, str]]
    preAggregationFilters: str = ""
    postAggregationFilters: str = ""
    timeDimension: List[str] = []
    geoDimension: List[str] = []
    categoricalDimension: List[str] = []
    response_type: str = "data"  # Default to data response

# Setup system instruction and API client
def setup_environment():
    # Load system instruction template
    with open(SYSTEM_INSTRUCTION_FILE, "r") as f:
        system_instruction_template = f.read()

    # Load all filter values directly from JSON file
    with open(os.path.join(FILTER_VALUES_DIR, "all_filters.json"), "r") as f:
        all_filters = json.load(f)

    # Format system instructions with the filter values
    system_instruction = system_instruction_template.format(
        all_filters=json.dumps(all_filters)
    )
    
    # Setup API client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable not set")
        raise ValueError("GEMINI_API_KEY is required")
        
    return system_instruction, genai.Client(api_key=api_key)

system_instruction, client = setup_environment()
logger.info("Environment setup completed")

# Helper functions
def classify_dimensions(dimensions: list[str]) -> tuple[list[str], list[str], list[str]]:
    """Classify dimensions into time, geo, and categorical dimensions.
    Note: Categorical dimensions now include all non-time dimensions (including geographic)."""
    time_dim = [dim for dim in dimensions if dim in TIME_DIMENSIONS]
    geo_dim = [dim for dim in dimensions if dim in GEO_DIMENSIONS]
    
    # New approach: All non-time dimensions are considered categorical
    cat_dim = [dim for dim in dimensions if dim not in time_dim]
    
    return time_dim, geo_dim, cat_dim

def is_measure_additive(measure_alias: str) -> bool:
    """Check if a measure is additive (can be summed)."""
    return measure_alias in ADDITIVE_MEASURES

def get_chart_options(agg_def: AggregationDefinition) -> tuple[list[str], str]:
    """
    Determine available chart types and ideal chart based on the flowchart in chart_classification.md
    Returns (available_charts, ideal_chart)
    """
    # Initialize with table as fallback
    available = ["table"]
    ideal = "table"
    
    # Extract dimensions and measures
    dimensions = agg_def.dimensions or []
    measures = agg_def.measures or []
    
    # Classify dimensions - note that cat_dim now includes geo dimensions
    time_dim, geo_dim, cat_dim = classify_dimensions(dimensions)
    dim_count = len(dimensions)  # Total dimension count
    time_count = len(time_dim)
    geo_count = len(geo_dim)
    cat_count = len(cat_dim)
    measure_count = len(measures)
    
    # Count additive measures instead of checking for non-additive
    additive_measure_count = sum(is_measure_additive(m["alias"]) for m in measures) if measures else 0
    
    # STEP 1: TEXT RESPONSE CHECK
    if hasattr(agg_def, 'response_type') and agg_def.response_type == "text":
        return ["text"], "text"
    
    # STEP 2: EMPTY DATA CHECK
    if not dimensions and not measures:
        return available, ideal
    
    # AVAILABLE CHART TYPES
    # Add chart types to available options based on classification rules
    
    # Single Bar Chart - Updated to match chart_classification.md
    if dim_count == 1 and measure_count == 1 and time_count == 0:
        available.append("single_bar_chart")
    
    # Line Chart
    if time_count == 1 and cat_count <= 1 and measure_count == 1:
        available.append("line_chart")
    
    # Stacked Area Chart - Only add if exactly 1 time dimension, 1 categorical dimension, and ALL measures are additive
    if time_count == 1 and cat_count == 1 and measure_count == 1 and additive_measure_count == measure_count:
        available.append("stacked_area_chart")
        available.append("stacked_area_chart_100")
    
    # Nested Bar Chart
    if 1 <= cat_count <= 2 and 1 <= measure_count <= 2 and (cat_count > 1 or measure_count > 1):
        available.append("nested_bar_chart")
    
    # Grouped Bar Chart
    if cat_count == 2 and measure_count == 1:
        available.append("grouped_bar_chart")
    
    # Stacked Bar Chart
    if cat_count == 2 and measure_count == 1 and additive_measure_count == measure_count:
        available.append("stacked_bar_chart")
        available.append("stacked_bar_chart_100")
    
    # Treemap
    if 1 <= cat_count <= 2 and measure_count == 1 and time_count == 0 and additive_measure_count == measure_count:
        available.append("treemap")
    
    # Heat Map
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1 and additive_measure_count == measure_count:
        geo_name = geo_dim[0].lower()
        if "location" in geo_name:
            available.append("heat_map")
    
    # Choropleth Map - Only add if ALL measures are additive
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1 and additive_measure_count == measure_count:
        geo_name = geo_dim[0].lower()
        if any(area in geo_name for area in ["borough", "county", "neighborhood"]):
            available.append("choropleth_map")
    
    # IDEAL CHART SELECTION
    # Follow the flowchart but respect additive measure constraints
    
    # STEP 3: GEOGRAPHIC DIMENSION CHECK
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1:
        geo_name = geo_dim[0].lower()
        
        # Only assign geographic visualizations as ideal if ALL measures are additive
        if additive_measure_count == measure_count:
            # Heat Map
            if "location" in geo_name:
                ideal = "heat_map"
            # Choropleth Map
            elif any(area in geo_name for area in ["borough", "county", "neighborhood"]):
                ideal = "choropleth_map"
    
    # STEP 4: TIME DIMENSION CHECK
    elif time_count == 1 and cat_count <= 1 and measure_count == 1:
        ideal = "line_chart"  # Line chart supports both additive and non-additive measures
        
        # If exactly one categorical dimension and measure is additive, suggest stacked area chart as ideal
        if cat_count == 1 and additive_measure_count == measure_count:
            ideal = "stacked_area_chart"
    
    # STEP 5: CATEGORICAL DIMENSION CHECK
    else:
        # Single Bar Chart - Updated to match chart_classification.md
        if dim_count == 1 and measure_count == 1 and time_count == 0:
            ideal = "single_bar_chart"  # Bar chart supports both additive and non-additive measures
        
        # Nested Bar Chart
        elif 1 <= cat_count <= 2 and 1 <= measure_count <= 2 and (cat_count + measure_count) <= 4:
            ideal = "nested_bar_chart"  # Nested bar chart supports both additive and non-additive measures
        
        # Grouped Bar Chart
        elif cat_count == 2 and measure_count == 1:
            ideal = "grouped_bar_chart"  # Grouped bar chart supports both additive and non-additive measures
    
    # Ensure unique chart types
    available = list(dict.fromkeys(available))
    
    logger.info(f"Chart options: {available}, ideal: {ideal}")
    return available, ideal

def generate_sql(definition: AggregationDefinition, table_name: str) -> str:
    """Generate SQL query from aggregation definition."""
    start_time = time.time()
    
    # Build SELECT clause
    dims = definition.dimensions
    dims_clause = ", ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    select_clause = f"{dims_clause}, {measures_clause}" if dims_clause and measures_clause else (dims_clause or measures_clause)
    sql = f"SELECT {select_clause} FROM {table_name}"
    
    # Add filters
    if definition.preAggregationFilters:
        sql += f" WHERE {definition.preAggregationFilters}"
    
    # Add grouping
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f" GROUP BY {group_clause}"
    
    # Add post-aggregation filters
    if definition.postAggregationFilters:
        sql += f" HAVING {definition.postAggregationFilters}"
    
    # Add ordering
    if definition.timeDimension:
        sql += f" ORDER BY {definition.timeDimension[0]} ASC"
    elif definition.measures:
        sql += f" ORDER BY {definition.measures[0]['alias']} DESC"
    
    # Add row limit
    sql += " LIMIT 1000;"
    
    elapsed = time.time() - start_time
    logger.debug(f"SQL generation completed in {elapsed:.2f}s")
    return sql.strip()

def execute_sql_in_duckDB(sql: str, db_filename: str) -> list:
    """Execute SQL query and return results."""
    start_time = time.time()
    logger.info(f"Executing SQL query in DuckDB")
    
    try:
        with duckdb.connect(db_filename) as con:
            df = con.execute(sql).fetchdf()
            row_count = len(df)
            logger.info(f"Query executed successfully: {row_count} rows returned")
    except Exception as e:
        logger.error(f"Database query failed: {str(e)}")
        logger.error(f"SQL: {sql}")
        raise
    
    # Format datetime columns
    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
    
    elapsed = time.time() - start_time
    logger.info(f"SQL execution completed in {elapsed:.2f}s")
    return json.loads(df.to_json(orient="records"))

def create_text_response(text: str) -> dict:
    """Create a standard text response payload."""
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
    """Extract and parse JSON from text, handling code blocks."""
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

def calculate_dimension_cardinality_stats(dataset: List[Dict], dimensions: List[str]) -> Dict[str, Dict[str, float]]:
    """Calculate cardinality statistics for each dimension in the aggregated dataset.
    
    Args:
        dataset: The aggregated dataset as a list of dictionaries
        dimensions: List of dimension names from the aggregation definition
        
    Returns:
        Dictionary with statistics for each dimension
    """
    if not dataset or not dimensions:
        return {}
    
    # Convert to Polars DataFrame for better performance
    try:
        df = pl.DataFrame(dataset)
    except Exception as e:
        logger.warning(f"Failed to convert dataset to Polars DataFrame: {str(e)}. Falling back to pandas.")
        import pandas as pd
        df = pd.DataFrame(dataset)
    
    stats = {}
    
    # For each dimension, calculate stats
    for dim in dimensions:
        # Skip if dimension is not in dataset
        if dim not in df.columns:
            continue
            
        # Count total unique values for this dimension
        total_unique = df[dim].n_unique()
        
        # If this is the only dimension, we can't calculate per-group stats
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
        
        # Get other dimensions to group by
        other_dims = [d for d in dimensions if d != dim]
        
        # Group by other dimensions and calculate unique counts for this dimension
        if isinstance(df, pl.DataFrame):
            # Polars implementation
            grouped = (df
                      .group_by(other_dims)
                      .agg(pl.col(dim).n_unique().alias("unique_count")))
            
            unique_counts = grouped["unique_count"].to_numpy()
        else:
            # Pandas fallback
            grouped = df.groupby(other_dims)[dim].nunique().reset_index()
            unique_counts = grouped[dim].values
        
        # Calculate statistics
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
    Reorder dimensions by their cardinality (higher cardinality first).
    Uses the total_unique count from dimension_stats.
    
    Args:
        agg_def: The aggregation definition
        dimension_stats: Statistics from calculate_dimension_cardinality_stats
        
    Returns:
        Updated aggregation definition with reordered dimensions
    """
    if not agg_def.dimensions or len(agg_def.dimensions) <= 1 or not dimension_stats:
        # No need to reorder if there are 0 or 1 dimensions
        return agg_def
    
    # Sort dimensions by total_unique (descending)
    sorted_dims = sorted(
        agg_def.dimensions,
        key=lambda dim: dimension_stats.get(dim, {}).get("total_unique", 0),
        reverse=True  # Higher cardinality first
    )
    
    # Create a new aggregation definition with reordered dimensions
    time_dim, geo_dim, cat_dim = classify_dimensions(sorted_dims)
    
    return agg_def.copy(update={
        "dimensions": sorted_dims,
        "timeDimension": time_dim,
        "geoDimension": geo_dim,
        "categoricalDimension": cat_dim
    })

# Process prompt endpoint
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Processing prompt: '{request_data.prompt[:50]}...'")
    start_time = time.time()
    
    try:
        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[request_data.prompt],
        )
        
        # Get response text
        json_text = response.candidates[0].content.parts[0].text
        parsed_json, is_valid_json = extract_json_from_text(json_text)
        
        # Handle text response
        if not is_valid_json or "textResponse" in parsed_json:
            text = parsed_json.get("textResponse", json_text)
            return JSONResponse(content=create_text_response(text))
        
        # Handle data response
        agg_def = AggregationDefinition(**parsed_json)
        
        # Classify dimensions
        time_dim, geo_dim, cat_dim = classify_dimensions(agg_def.dimensions)
        agg_def = agg_def.copy(update={
            "timeDimension": time_dim,
            "geoDimension": geo_dim,
            "categoricalDimension": cat_dim
        })
        
        # Generate and execute SQL
        sql = generate_sql(agg_def, "requests_311")
        dataset = execute_sql_in_duckDB(sql, DB_FILE_NAME)
        
        # Calculate dimension cardinality statistics
        dimension_stats = {}
        if dataset and agg_def.dimensions:
            dimension_stats = calculate_dimension_cardinality_stats(dataset, agg_def.dimensions)
            
            # Reorder dimensions based on cardinality
            agg_def = reorder_dimensions_by_cardinality(agg_def, dimension_stats)
        
        # Determine visualization options
        available_charts, ideal_chart = get_chart_options(agg_def)
        
        # Create response
        response_payload = {
            "dataset": dataset,
            "fields": list(dataset[0].keys()) if dataset else [],
            "sql": sql,
            "aggregationDefinition": agg_def.dict(),
            "chartType": ideal_chart,
            "availableChartTypes": available_charts,
            "dimensionStats": dimension_stats,  # Add the stats to the response
            "textResponse": None
        }
        
        elapsed = time.time() - start_time
        logger.info(f"[{request_id}] Request completed in {elapsed:.2f}s")
        return JSONResponse(content=response_payload)
        
    except Exception as error:
        logger.exception(f"[{request_id}] Error processing prompt")
        return JSONResponse(status_code=500, content={"error": str(error)})
