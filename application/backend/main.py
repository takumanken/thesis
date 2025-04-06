import logging
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
import os
import json
import duckdb
from typing import List, Dict

# Set up logging
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
    allow_origins=[
        "https://takumanken.github.io",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# Define constants and initialize Gemini API client
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

def classify_dimensions(dimensions: List[str]):
    time_dims = {"created_week", "closed_week", "created_date", "created_month", "created_year", "closed_date", "closed_month", "closed_year"}
    geo_dims = {"borough", "county", "location", "incident_zip", "neighborhood_name"}
    time_dimension = []
    geo_dimension = []
    categorical_dimension = []
    for dim in dimensions:
        if dim in time_dims:
            time_dimension.append(dim)
        elif dim in geo_dims:
            geo_dimension.append(dim)
        else:
            categorical_dimension.append(dim)
    return time_dimension, geo_dimension, categorical_dimension

# Add or update helper function to determine chart options
def get_chart_options(agg_def: AggregationDefinition) -> tuple[str, list[str]]:
    ideal = "table"
    available = ["table"]
    time_dimension, geo_dimension, categorical_dimension = classify_dimensions(agg_def.dimensions)
    if len(agg_def.measures) == 1 and len(agg_def.dimensions) == 1:
        available.append("bar_chart")
        ideal = "bar_chart"
        if len(time_dimension) == 1:
            available.append("line_chart")
            ideal = "line_chart"
        elif len(geo_dimension) == 1:
            available.append("map")
            ideal = "map"
    return ideal, available

@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    logger.info("Received prompt request.")
    try:
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
        
        # Create AggregationDefinition instance.
        aggregation_definition = AggregationDefinition(**parsed_json)
        time_dim, geo_dim, categorical_dim = classify_dimensions(aggregation_definition.dimensions)
        agg_def_with_dims = {
            **aggregation_definition.dict(),
            "time_dimension": time_dim,
            "geo_dimension": geo_dim,
            "categorical_dimension": categorical_dim
        }
        aggregation_definition = AggregationDefinition(**agg_def_with_dims)
        sql = generate_sql(aggregation_definition, "requests_311")
        logger.info("Generated SQL: %s", sql)
        
        dataset = json.loads(execute_sql_in_duckDB(sql, DB_FILE_NAME))
        logger.info("SQL executed successfully. Result: %s", dataset)
        
        ideal_chart, available_charts = get_chart_options(aggregation_definition)
        
        return JSONResponse(content={
            "dataset": dataset,
            "fields": list(dataset[0].keys()) if dataset else [],
            "sql": sql,
            "aggregation_definition": agg_def_with_dims,
            "chart_type": ideal_chart,
            "available_chart_types": available_charts
        })

    except Exception as error:
        logger.exception("Error processing prompt.")
        return JSONResponse(status_code=500, content={"error": str(error)})

def generate_sql(definition: AggregationDefinition, table_name: str) -> str:

    dims = definition.dimensions
    dims_clause = ", ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    
    if dims_clause and measures_clause:
        select_clause = f"{dims_clause}, {measures_clause}"
    elif dims_clause:
        select_clause = dims_clause
    else:
        select_clause = measures_clause

    sql = f"SELECT {select_clause} FROM {table_name}"
    
    if definition.pre_aggregation_filters:
        sql += f" WHERE {definition.pre_aggregation_filters}"
        
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f" GROUP BY {group_clause}"
        
    if definition.post_aggregation_filters:
        sql += f" HAVING {definition.post_aggregation_filters}"
    
    # Use safe lookup for time_dimension.
    time_dimension = getattr(definition, "time_dimension", [])
    if time_dimension:
        sql += f" ORDER BY {time_dimension[0]} ASC"
    elif definition.measures:
        sql += f" ORDER BY {definition.measures[0]['alias']} DESC"
    
    sql += " LIMIT 1000;"
    return sql.strip()

def execute_sql_in_duckDB(sql: str, db_filename: str) -> str:
    try:
        with duckdb.connect(db_filename) as con:
            result = con.execute(sql)
            df = result.fetchdf()
    except Exception as e:
        logger.error("Database query failed: %s", str(e))
        raise

    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
    return df.to_json(orient="records")
