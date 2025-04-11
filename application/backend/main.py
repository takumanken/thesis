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
    "created_hour_datepart", "created_weekday_datepart",
    "closed_year_datepart", "closed_month_datepart", "closed_day_datepart",
    "closed_hour_datepart"
]
GEO_DIMENSIONS = ["borough", "county", "location", "incident_zip", "neighborhood_name"]
CATEGORICAL_DIMENSIONS = [
    "unique_key", "status", "agency_category", "agency_name",
    "complaint_type_large", "complaint_type_middle", "complaint_type_detailed",
    "is_noise_complaint", "descriptor", "street_name", "street_number", "community_board"
]

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
    """Classify dimensions into time, geo, and categorical dimensions."""
    time_dim = [dim for dim in dimensions if dim in TIME_DIMENSIONS]
    geo_dim = [dim for dim in dimensions if dim in GEO_DIMENSIONS]
    cat_dim = [dim for dim in dimensions if dim not in time_dim and dim not in geo_dim]
    return time_dim, geo_dim, cat_dim

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
    
    # Classify dimensions
    time_dim, geo_dim, cat_dim = classify_dimensions(dimensions)
    dim_count = len(dimensions)  # Total dimension count
    time_count = len(time_dim)
    geo_count = len(geo_dim)
    cat_count = len(cat_dim)
    measure_count = len(measures)
    
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
    
    # Nested Bar Chart
    if 1 <= cat_count <= 2 and 1 <= measure_count <= 2 and (cat_count > 1 or measure_count > 1):
        available.append("nested_bar_chart")
    
    # Grouped Bar Chart & Stacked Bar Chart
    if cat_count == 2 and measure_count == 1:
        available.append("grouped_bar_chart")
        available.append("stacked_bar_chart")
    
    # Treemap
    if 1 <= dim_count <= 2 and measure_count == 1  and time_count == 0:
        available.append("treemap")
    
    # Heat Map
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1:
        geo_name = geo_dim[0].lower()
        if "location" in geo_name:
            available.append("heat_map")
    
    # Choropleth Map
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1:
        geo_name = geo_dim[0].lower()
        if any(area in geo_name for area in ["borough", "county", "neighborhood"]):
            available.append("choropleth_map")
    
    # IDEAL CHART SELECTION
    # Follow the flowchart exactly as specified in chart_classification.md
    
    # STEP 3: GEOGRAPHIC DIMENSION CHECK
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1:
        geo_name = geo_dim[0].lower()
        
        # Heat Map
        if "location" in geo_name:
            ideal = "heat_map"
        # Choropleth Map
        elif any(area in geo_name for area in ["borough", "county", "neighborhood"]):
            ideal = "choropleth_map"
    
    # STEP 4: TIME DIMENSION CHECK
    elif time_count == 1 and cat_count <= 1 and measure_count == 1:
        ideal = "line_chart"
    
    # STEP 5: CATEGORICAL DIMENSION CHECK
    else:
        # Single Bar Chart - Updated to match chart_classification.md
        if dim_count == 1 and measure_count == 1 and time_count == 0:
            ideal = "single_bar_chart"
        
        # Nested Bar Chart
        elif 1 <= dim_count <= 2 and 1 <= measure_count <= 2 and (cat_count + measure_count) <= 4:
            ideal = "nested_bar_chart"
        
        # Grouped Bar Chart
        elif cat_count == 2 and measure_count == 1:
            ideal = "grouped_bar_chart"
    
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
            "textResponse": None
        }
        
        elapsed = time.time() - start_time
        logger.info(f"[{request_id}] Request completed in {elapsed:.2f}s")
        return JSONResponse(content=response_payload)
        
    except Exception as error:
        logger.exception(f"[{request_id}] Error processing prompt")
        return JSONResponse(status_code=500, content={"error": str(error)})
