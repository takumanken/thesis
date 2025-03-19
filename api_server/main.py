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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables and initialize FastAPI
load_dotenv()
app = FastAPI()

# Set up rate limiting and attach the handler
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS for allowed origins and methods
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
    dimensions: list[str]
    measures: list[str]
    pre_aggregation_filters: str
    post_aggregation_filters: str

class AggregationResponse(BaseModel):
    aggregation_definition: AggregationDefinition
    chart_type: Chart

# Process prompt endpoint
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    logger.info("Received prompt request.")
    try:
        # Generate content using Gemini API
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[request_data.prompt],
        )

        json_text = response.candidates[0].content.parts[0].text

        # Clean up response if wrapped in markdown
        if json_text.startswith("```json"):
            json_text = json_text.replace("```json", "").replace("```", "").strip()

        parsed_json = json.loads(json_text)

        # Check if no answer was provided
        if parsed_json.get("chart_type") == "no_answer":
            raise Exception("No answer found for the prompt.")

        # Build SQL query from the aggregation definition
        agg_def_data = parsed_json.get("aggregation_definition")
        aggregation_definition = AggregationDefinition(**agg_def_data)
        sql = generate_sql(aggregation_definition, "requests_311")
        logger.info("Generated SQL: %s", sql)
        
        # Execute the SQL query and log result
        result = execute_sql_in_duckDB(sql, DB_FILE_NAME)
        logger.info("SQL executed successfully. Result: %s", result)
        return JSONResponse(content={"result": result, "sql": sql, "agg_def": json_text})

    except Exception as error:
        logger.exception("Error processing prompt.")
        return JSONResponse(status_code=500, content={"error": str(error)})

# Generate SQL based on aggregation definition
def generate_sql(definition: AggregationDefinition, table_name: str):
    dimensions = ", ".join(definition.dimensions)
    measures = ", ".join(definition.measures) if definition.measures else ""
    sql = f"SELECT {dimensions}, {measures} FROM {table_name}"
    
    if definition.pre_aggregation_filters:
        sql += f" WHERE {definition.pre_aggregation_filters}"
    
    sql += f" GROUP BY {dimensions}"
    
    if definition.post_aggregation_filters:
        sql += f" HAVING {definition.post_aggregation_filters}"
    
    if len(definition.measures) > 0:
        sql += f" ORDER BY {len(definition.dimensions) + 1} DESC"

    sql += " LIMIT 1000;"

    return sql.strip()

# Execute the SQL query in DuckDB
def execute_sql_in_duckDB(sql: str, db_filename: str):
    logger.info("Executing SQL on DuckDB.")
    con = duckdb.connect(db_filename)
    result = con.execute(sql)
    logger.info("SQL query executed; fetching results.")
    df = result.fetchdf()
    con.close()
    logger.info("SQL execution complete.")
    return df.to_json(orient="records")
