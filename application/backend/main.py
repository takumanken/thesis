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
from typing import List, Dict

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

# Constants and Gemini API client
PUBLIC_BUCKET_URL = "https://pub-cb6e94f4490c42b9b0c520e8116fb9b7.r2.dev/"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DB_FILE_NAME = "nyc_open_data.db"
SYSTEM_INSTRUCTION_FILE = "system_instruction.txt"
FILTER_VALUES_DIR = "filter_values"

# Load system instruction template
with open(SYSTEM_INSTRUCTION_FILE, "r") as f:
    system_instruction_template = f.read()

# Load all filter values directly from JSON file
with open(os.path.join(FILTER_VALUES_DIR, "all_filters.json"), "r") as f:
    all_filters = json.load(f)

# Format system instructions with the complete filter values JSON
system_instruction = system_instruction_template.format(
    all_filters=json.dumps(all_filters)
)

logger.debug(f"System instructions formatted, length: {len(system_instruction)} chars")

if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY environment variable not set")
    raise ValueError("GEMINI_API_KEY is required")

client = genai.Client(api_key=GEMINI_API_KEY)
logger.info("Gemini API client initialized")

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

# Updated classify_dimensions function
def classify_dimensions(dimensions: list[str]) -> tuple[list[str], list[str], list[str]]:
    """
    Classify dimensions into time, geo, and categorical dimensions.
    """
    time_dimensions = [
        "created_week", "closed_week", "created_date", "closed_date",
        "created_month", "closed_month", "created_year", "closed_year",
        "created_year_datepart", "created_month_datepart", "created_day_datepart",
        "created_hour_datepart", "created_weekday_datepart",
        "closed_year_datepart", "closed_month_datepart", "closed_day_datepart",
        "closed_hour_datepart"
    ]
    geo_dimensions = ["borough", "county", "location", "incident_zip", "neighborhood_name"]
    categorical_dimensions = [
        "unique_key", "status", "agency_category", "agency_name",
        "complaint_type_large", "complaint_type_middle", "complaint_type_detailed",
        "is_noise_complaint", "descriptor", "street_name", "street_number", "community_board"
    ]

    time_dim = [dim for dim in dimensions if dim in time_dimensions]
    geo_dim = [dim for dim in dimensions if dim in geo_dimensions]
    categorical_dim = [dim for dim in dimensions if dim in categorical_dimensions]

    return time_dim, geo_dim, categorical_dim

# Updated chart options function with time dimension logic
def get_chart_options(agg_def: AggregationDefinition) -> tuple[str, list[str]]:
    time_dim, geo_dim, _ = classify_dimensions(agg_def.dimensions)
    ideal = "table"
    available = ["table"]

    if len(agg_def.measures) == 1:
        measure_alias = agg_def.measures[0].get("alias", "")
        is_additive_measure = measure_alias != "avg_days_to_resolve"

        logger.debug(f"Measure '{measure_alias}' is {'additive' if is_additive_measure else 'non-additive'}")

        if len(agg_def.dimensions) == 1:
            available.append("single_bar_chart")
            if is_additive_measure and not time_dim:
                available.append("treemap")
            ideal = "single_bar_chart"

        if len(agg_def.dimensions) == 2:
            available.append("grouped_bar_chart")
            if is_additive_measure:
                available.append("stacked_bar_chart")
                available.append("stacked_bar_chart_100")
                if not time_dim:
                    available.append("treemap")
            ideal = "stacked_bar_chart" if is_additive_measure else "grouped_bar_chart"

        if time_dim:
            available.append("line_chart")
            ideal = "line_chart"
            logger.debug("Time dimension detected: adding line_chart")

        if geo_dim and len(agg_def.dimensions) == 1:
            available.append("choropleth_map")
            ideal = "choropleth_map"

    logger.info(f"Chart options - Ideal: {ideal}, Available: {available}")
    return ideal, available

# Generate SQL from the aggregation definition
def generate_sql(definition: AggregationDefinition, table_name: str) -> str:
    logger.debug(f"Generating SQL for table: {table_name}")
    start_time = time.time()
    
    dims = definition.dimensions
    dims_clause = ", ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    select_clause = f"{dims_clause}, {measures_clause}" if dims_clause and measures_clause else (dims_clause or measures_clause)
    sql = f"SELECT {select_clause} FROM {table_name}"
    
    if definition.preAggregationFilters:
        sql += f" WHERE {definition.preAggregationFilters}"
        logger.debug(f"Added pre-aggregation filters: {definition.preAggregationFilters}")
    
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f" GROUP BY {group_clause}"
    
    if definition.postAggregationFilters:
        sql += f" HAVING {definition.postAggregationFilters}"
        logger.debug(f"Added post-aggregation filters: {definition.postAggregationFilters}")
    
    # Order by first time dimension (asc) if available, else by first measure alias (desc)
    if definition.timeDimension:
        sql += f" ORDER BY {definition.timeDimension[0]} ASC"
    elif definition.measures:
        sql += f" ORDER BY {definition.measures[0]['alias']} DESC"
    
    sql += " LIMIT 1000;"
    
    elapsed = time.time() - start_time
    logger.debug(f"SQL generation completed in {elapsed:.2f}s")
    return sql.strip()

# Execute SQL using DuckDB and return JSON records
def execute_sql_in_duckDB(sql: str, db_filename: str) -> str:
    start_time = time.time()
    logger.info(f"Executing SQL query in DuckDB: {db_filename}")
    
    try:
        with duckdb.connect(db_filename) as con:
            logger.debug("Connected to DuckDB database")
            df = con.execute(sql).fetchdf()
            row_count = len(df)
            logger.info(f"Query executed successfully: {row_count} rows returned")
    except Exception as e:
        logger.error(f"Database query failed: {str(e)}")
        logger.error(f"Problematic SQL: {sql}")
        raise
    
    # Format datetime columns
    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
        logger.debug(f"Formatted datetime column: {col}")
    
    elapsed = time.time() - start_time
    logger.info(f"SQL execution completed in {elapsed:.2f}s")
    return df.to_json(orient="records")

# Process prompt endpoint
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    request_id = str(uuid.uuid4())[:8]  # Generate short request ID for traceability
    logger.info(f"[{request_id}] Received prompt request: '{request_data.prompt[:50]}...'")
    start_time = time.time()
    
    try:
        # Generate content via Gemini API
        logger.info(f"[{request_id}] Calling Gemini API")
        api_start_time = time.time()
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[request_data.prompt],
        )
        
        api_elapsed = time.time() - api_start_time
        logger.info(f"[{request_id}] Gemini API responded in {api_elapsed:.2f}s")
        
        # Log the raw response from Gemini
        json_text = response.candidates[0].content.parts[0].text
        logger.info(f"[{request_id}] Raw Gemini response:\n{json_text}")
        
        try:
            is_json_response = json_text.strip().startswith("{") or "```json" in json_text
            
            # Clean up JSON formatting if it's in a code block
            if "```json" in json_text:
                json_text = json_text.split("```json")[1].split("```")[0].strip()
                logger.debug(f"[{request_id}] Extracted JSON from code block")
            
            if is_json_response:
                # Try to parse as JSON
                parsed_json = json.loads(json_text)
                logger.debug(f"[{request_id}] Successfully parsed JSON response")
                
                # Check if this is a text response in JSON format
                if "textResponse" in parsed_json:
                    logger.info(f"[{request_id}] Received textResponse in JSON format")
                    response_payload = {
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
                        "textResponse": parsed_json["textResponse"]
                    }
                else:
                    # Continue with normal data processing for aggregation definitions
                    agg_def = AggregationDefinition(**parsed_json)
                    time_dim, geo_dim, categorical_dim = classify_dimensions(agg_def.dimensions)
                    agg_def = agg_def.copy(update={
                        "timeDimension": time_dim,
                        "geoDimension": geo_dim,
                        "categoricalDimension": categorical_dim
                    })
                    logger.info(f"[{request_id}] Aggregation definition: {agg_def.dict()}")
                    
                    # Generate and execute SQL
                    sql = generate_sql(agg_def, "requests_311")
                    logger.info(f"[{request_id}] Generated SQL: {sql}")
                    
                    dataset_json = execute_sql_in_duckDB(sql, DB_FILE_NAME)
                    dataset = json.loads(dataset_json)
                    logger.info(f"[{request_id}] Query returned {len(dataset)} records")
                    
                    # Determine visualization options
                    ideal_chart, available_charts = get_chart_options(agg_def)
                    
                    # Prepare normal data response
                    response_payload = {
                        "dataset": dataset,
                        "fields": list(dataset[0].keys()) if dataset else [],
                        "sql": sql,
                        "aggregationDefinition": agg_def.dict(),
                        "chartType": ideal_chart,
                        "availableChartTypes": available_charts,
                        "textResponse": None
                    }
            else:
                # Handle as text response
                logger.info(f"[{request_id}] Received text response instead of JSON")
                response_payload = {
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
                    "textResponse": json_text
                }
        except json.JSONDecodeError as e:
            # JSON parsing error - treat as text response
            logger.warning(f"[{request_id}] JSON parse error: {str(e)}")
            logger.warning(f"[{request_id}] Raw text: {json_text[:200]}...")
            
            response_payload = {
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
                "textResponse": json_text
            }
        
        total_elapsed = time.time() - start_time
        logger.info(f"[{request_id}] Request processed successfully in {total_elapsed:.2f}s")
        return JSONResponse(content=response_payload)
    
    except Exception as error:
        elapsed = time.time() - start_time
        logger.exception(f"[{request_id}] Error processing prompt after {elapsed:.2f}s")
        return JSONResponse(status_code=500, content={"error": str(error)})
