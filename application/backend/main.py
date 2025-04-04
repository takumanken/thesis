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
import enum
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

class Chart(enum.Enum):
    TABLE = "table"
    LINE_CHART = "line_chart"
    BAR_CHART = "bar_chart"
    NO_ANSWER = "no_answer"

class AggregationDefinition(BaseModel):
    time_dimension: list[str]
    categorical_dimension: list[str]
    measures: list[dict]
    pre_aggregation_filters: str
    post_aggregation_filters: str

class AggregationResponse(BaseModel):
    aggregation_definition: AggregationDefinition
    chart_type: Chart

@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    logger.info("Received prompt request.")
    try:
        # Generate response using Gemini API
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[request_data.prompt],
        )
        json_text = response.candidates[0].content.parts[0].text

        # Remove markdown formatting if present
        if json_text.startswith("```json"):
            json_text = json_text.replace("```json", "").replace("```", "").strip()

        parsed_json = json.loads(json_text)
        if parsed_json.get("chart_type") == "no_answer":
            raise Exception("No answer found for the prompt.")

        # Build SQL query from the aggregation definition
        agg_def_data = parsed_json.get("aggregation_definition")
        aggregation_definition = AggregationDefinition(**agg_def_data)
        dimensions = aggregation_definition.time_dimension + aggregation_definition.categorical_dimension
        sql = generate_sql(aggregation_definition, dimensions, "requests_311")
        logger.info("Generated SQL: %s", sql)
        
        # Execute SQL query and parse result
        dataset = json.loads(execute_sql_in_duckDB(sql, DB_FILE_NAME))
        logger.info("SQL executed successfully. Result: %s", dataset)
        
        # Combine time_dimension and categorical_dimension into dimensions
        dimensions = aggregation_definition.time_dimension + aggregation_definition.categorical_dimension

        return JSONResponse(content={
            "dataset": dataset,
            "fields": list(dataset[0].keys()),
            "sql": sql,
            "aggregation_definition": agg_def_data,
            "chart_type": parsed_json.get("chart_type"),
            "dimensions": dimensions
        })

    except Exception as error:
        logger.exception("Error processing prompt.")
        return JSONResponse(status_code=500, content={"error": str(error)})

def generate_sql(definition: AggregationDefinition, dims: list[str], table_name: str) -> str:
    """
    Generate an SQL query based on the aggregation definition.
    Uses the pre-combined dimensions (dims) from time_dimension and categorical_dimension.
    If a time dimension exists, orders by it (ascending). Otherwise, orders by the first measure.
    """
    dims_clause = ", ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    
    # Build the SELECT clause.
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
    """
    Execute the SQL query in DuckDB and return results as JSON.
    """
    try:
        with duckdb.connect(db_filename) as con:
            result = con.execute(sql)
            df = result.fetchdf()
    except Exception as e:
        logger.error("Database query failed: %s", str(e))
        raise

    # Convert datetime columns to string for JSON serialization
    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
    return df.to_json(orient="records")
