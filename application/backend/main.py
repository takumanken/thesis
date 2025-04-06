import logging
import os
import json
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

# Basic logging setup
logging.basicConfig(level=logging.INFO)
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
with open(SYSTEM_INSTRUCTION_FILE, "r") as file:
    system_instruction = file.read()
client = genai.Client(api_key=GEMINI_API_KEY)

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
    return time_dim, geo_dim, cat_dim

# Determine chart options based on dimensions and measures
def get_chart_options(agg_def: AggregationDefinition) -> tuple[str, list[str]]:
    ideal = "table"
    available = ["table"]
    time_dim, geo_dim, _ = classify_dimensions(agg_def.dimensions)
    if len(agg_def.measures) == 1:
        if len(agg_def.dimensions) == 1:
            available.append("single_bar_chart")
            ideal = "single_bar_chart"
        if len(agg_def.dimensions) == 2:
            available.append("grouped_bar_chart")
            ideal = "grouped_bar_chart"
        if time_dim and len(agg_def.dimensions) <= 2:
            available.append("line_chart")
            ideal = "line_chart"
        if geo_dim and len(agg_def.dimensions) == 1:
            available.append("map")
            ideal = "map"
    return ideal, available

# Generate SQL from the aggregation definition
def generate_sql(definition: AggregationDefinition, table_name: str) -> str:
    dims = definition.dimensions
    dims_clause = ", ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    select_clause = f"{dims_clause}, {measures_clause}" if dims_clause and measures_clause else (dims_clause or measures_clause)
    sql = f"SELECT {select_clause} FROM {table_name}"
    if definition.pre_aggregation_filters:
        sql += f" WHERE {definition.pre_aggregation_filters}"
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f" GROUP BY {group_clause}"
    if definition.post_aggregation_filters:
        sql += f" HAVING {definition.post_aggregation_filters}"
    # Order by first time dimension (asc) if available, else by first measure alias (desc)
    if definition.time_dimension:
        sql += f" ORDER BY {definition.time_dimension[0]} ASC"
    elif definition.measures:
        sql += f" ORDER BY {definition.measures[0]['alias']} DESC"
    sql += " LIMIT 1000;"
    return sql.strip()

# Execute SQL using DuckDB and return JSON records
def execute_sql_in_duckDB(sql: str, db_filename: str) -> str:
    try:
        with duckdb.connect(db_filename) as con:
            df = con.execute(sql).fetchdf()
    except Exception as e:
        logger.error("Database query failed: %s", str(e))
        raise
    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
    return df.to_json(orient="records")

# Process prompt endpoint
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    logger.info("Received prompt request.")
    try:
        # Generate content via Gemini API
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[request_data.prompt],
        )
        json_text = response.candidates[0].content.parts[0].text
        if json_text.startswith("```json"):
            json_text = json_text.replace("```json", "").replace("```", "").strip()

        parsed_json = json.loads(json_text)
        if not parsed_json:
            raise Exception("Aggregation definition not found in response.")
        # Create and update the aggregation definition in one instance
        agg_def = AggregationDefinition(**parsed_json)
        time_dim, geo_dim, categorical_dim = classify_dimensions(agg_def.dimensions)
        agg_def = agg_def.copy(update={
            "time_dimension": time_dim,
            "geo_dimension": geo_dim,
            "categorical_dimension": categorical_dim
        })
        logger.info("Aggregation definition updated: %s", agg_def.dict())
        
        sql = generate_sql(agg_def, "requests_311")
        logger.info("Generated SQL: %s", sql)
        dataset = json.loads(execute_sql_in_duckDB(sql, DB_FILE_NAME))
        logger.info("SQL executed successfully. Result: %s", dataset)
        
        ideal_chart, available_charts = get_chart_options(agg_def)
        return JSONResponse(content={
            "dataset": dataset,
            "fields": list(dataset[0].keys()) if dataset else [],
            "sql": sql,
            "aggregation_definition": agg_def.dict(),
            "chart_type": ideal_chart,
            "available_chart_types": available_charts
        })
    except Exception as error:
        logger.exception("Error processing prompt.")
        return JSONResponse(status_code=500, content={"error": str(error)})
