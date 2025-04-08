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

logger.info(f"Loading system instructions from: {SYSTEM_INSTRUCTION_FILE}")
try:
    with open(SYSTEM_INSTRUCTION_FILE, "r") as file:
        system_instruction = file.read()
    logger.debug(f"System instructions loaded, length: {len(system_instruction)} chars")
except Exception as e:
    logger.error(f"Failed to load system instructions: {str(e)}")
    raise

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
    pre_aggregation_filters: str = ""
    post_aggregation_filters: str = ""
    time_dimension: List[str] = []
    geo_dimension: List[str] = []
    categorical_dimension: List[str] = []

# Classify dimensions into time, geo, and categorical
def classify_dimensions(dimensions: List[str]):
    logger.debug(f"Classifying dimensions: {dimensions}")
    time_keys = {"created_week", "closed_week", "created_date", "created_month", "created_year", "closed_date", "closed_month", "closed_year"}
    geo_keys = {"borough", "county", "location", "incident_zip", "neighborhood_name"}
    time_dim, geo_dim, cat_dim = [], [], []
    for d in dimensions:
        if d in time_keys:
            time_dim.append(d)
        elif d in geo_keys:
            geo_dim.append(d)
        else:
            cat_dim.append(d)
    logger.debug(f"Classification result - Time: {time_dim}, Geo: {geo_dim}, Categorical: {cat_dim}")
    return time_dim, geo_dim, cat_dim

# Determine chart options based on dimensions and measures
def get_chart_options(agg_def: AggregationDefinition) -> tuple[str, list[str]]:
    logger.debug(f"Determining chart options for: {agg_def.dict()}")
    ideal = "table"
    available = ["table"]
    time_dim, geo_dim, _ = classify_dimensions(agg_def.dimensions)
    
    if len(agg_def.measures) == 1:
        if len(agg_def.dimensions) == 1:
            available.append("single_bar_chart")
            ideal = "single_bar_chart"
            logger.debug("Single dimension detected: adding single_bar_chart")
        if len(agg_def.dimensions) == 2:
            available.append("grouped_bar_chart")
            ideal = "grouped_bar_chart"
            logger.debug("Two dimensions detected: adding grouped_bar_chart")
        if time_dim and len(agg_def.dimensions) <= 2:
            available.append("line_chart")
            ideal = "line_chart"
            logger.debug("Time dimension detected: adding line_chart")
        if geo_dim and len(agg_def.dimensions) == 1:
            available.append("choropleth_map")
            ideal = "choropleth_map"
            logger.debug("Geo dimension detected: adding choropleth_map")
        if geo_dim == ["location"] and len(agg_def.dimensions) == 1:
            available.append("heat_map")
            ideal = "heat_map"
            logger.debug("Location dimension detected: adding heat_map")
    
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
    
    if definition.pre_aggregation_filters:
        sql += f" WHERE {definition.pre_aggregation_filters}"
        logger.debug(f"Added pre-aggregation filters: {definition.pre_aggregation_filters}")
    
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f" GROUP BY {group_clause}"
    
    if definition.post_aggregation_filters:
        sql += f" HAVING {definition.post_aggregation_filters}"
        logger.debug(f"Added post-aggregation filters: {definition.post_aggregation_filters}")
    
    # Order by first time dimension (asc) if available, else by first measure alias (desc)
    if definition.time_dimension:
        sql += f" ORDER BY {definition.time_dimension[0]} ASC"
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
        
        # Parse JSON response
        if json_text.startswith("```json"):
            json_text = json_text.replace("```json", "").replace("```", "").strip()
            logger.debug(f"[{request_id}] Extracted JSON from code block")

        # Parse the response
        try:
            parsed_json = json.loads(json_text)
            logger.debug(f"[{request_id}] Successfully parsed JSON response")
        except json.JSONDecodeError as e:
            logger.error(f"[{request_id}] JSON parse error: {str(e)}")
            logger.error(f"[{request_id}] Raw JSON text: {json_text[:200]}...")
            raise Exception(f"Failed to parse JSON response: {str(e)}")
            
        if not parsed_json:
            logger.error(f"[{request_id}] Empty JSON response from Gemini")
            raise Exception("Aggregation definition not found in response.")
            
        # Create and update the aggregation definition
        logger.info(f"[{request_id}] Creating aggregation definition")
        agg_def = AggregationDefinition(**parsed_json)
        time_dim, geo_dim, categorical_dim = classify_dimensions(agg_def.dimensions)
        agg_def = agg_def.copy(update={
            "time_dimension": time_dim,
            "geo_dimension": geo_dim,
            "categorical_dimension": categorical_dim
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
        
        # Prepare response
        response_payload = {
            "dataset": dataset,
            "fields": list(dataset[0].keys()) if dataset else [],
            "sql": sql,
            "aggregation_definition": agg_def.dict(),
            "chart_type": ideal_chart,
            "available_chart_types": available_charts
        }
        
        total_elapsed = time.time() - start_time
        logger.info(f"[{request_id}] Request processed successfully in {total_elapsed:.2f}s")
        return JSONResponse(content=response_payload)
    
    except Exception as error:
        elapsed = time.time() - start_time
        logger.exception(f"[{request_id}] Error processing prompt after {elapsed:.2f}s")
        return JSONResponse(status_code=500, content={"error": str(error)})
