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
    time_dimension: list[str]
    categorical_dimension: list[str]
    measures: list[dict]
    pre_aggregation_filters: str
    post_aggregation_filters: str

    @property
    def dimensions(self) -> list[str]:
        return self.time_dimension + self.categorical_dimension

def determine_ideal_chart(agg_def: AggregationDefinition) -> str:
    if len(agg_def.dimensions) == 1:
        if len(agg_def.categorical_dimension) == 1 and len(agg_def.measures) == 1:
            return "bar_chart"
        elif len(agg_def.time_dimension) == 1 and len(agg_def.measures) == 1:
            return "line_chart"
    else:
        return "table"

def determine_available_charts(agg_def: AggregationDefinition) -> list:
    available = ["table"]
    if len(agg_def.dimensions) == 1:
        if len(agg_def.categorical_dimension) == 1 and len(agg_def.measures) == 1:
            available.append("bar_chart")
        if len(agg_def.time_dimension) == 1 and len(agg_def.measures) == 1:
            available.append("line_chart")
    return available

def get_chart_options(agg_def: AggregationDefinition) -> tuple[str, list[str]]:
    ideal = "table"
    available = ["table"]
    if len(agg_def.measures) == 1 and len(agg_def.dimensions) == 1:
        if len(agg_def.categorical_dimension) == 1:
            ideal = "bar_chart"
            available.append("bar_chart")
        elif len(agg_def.time_dimension) == 1:
            ideal = "line_chart"
            available.append("line_chart")
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
        
        # Create and use a single AggregationDefinition instance.
        aggregation_definition = AggregationDefinition(**parsed_json)
        sql = generate_sql(aggregation_definition, "requests_311")
        logger.info("Generated SQL: %s", sql)
        dataset = json.loads(execute_sql_in_duckDB(sql, DB_FILE_NAME))
        logger.info("SQL executed successfully. Result: %s", dataset)
        
        ideal_chart, available_charts = get_chart_options(aggregation_definition)
        agg_def_with_dims = { **aggregation_definition.dict(), "dimensions": aggregation_definition.dimensions }
        
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
    if dims_clause:
        sql += f" GROUP BY {dims_clause}"
    if definition.post_aggregation_filters:
        sql += f" HAVING {definition.post_aggregation_filters}"
    
    if definition.time_dimension and len(definition.time_dimension) > 0:
        sql += f" ORDER BY {definition.time_dimension[0]} ASC"
    elif definition.measures:
        sql += f" ORDER BY {len(dims) + 1} DESC"
    
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
