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

# Load environment variables and initialize the app.
load_dotenv()
app = FastAPI()

# Set up rate limiting and attach the rate limit handler.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS to allow specific origins and methods.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://takumanken.github.io"],
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# Define constants and initialize Gemini API client.
PUBLIC_BUCKET_URL = "https://pub-cb6e94f4490c42b9b0c520e8116fb9b7.r2.dev/"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DB_FILE_NAME = "nyc_open_data.db"
SYSTEM_INSTRUCTION_FILE = "system_instruction.txt"

with open(SYSTEM_INSTRUCTION_FILE, "r") as file:
    system_instruction = file.read()

client = genai.Client(api_key=GEMINI_API_KEY)

# Define data models.
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
    pre_filters: list[str]
    post_filters: list[str]

class AggregationResponse(BaseModel):
    definition: AggregationDefinition
    chart_type: Chart

# Process the prompt and return the generated content.
@app.post("/process")
@limiter.limit("10/minute")
async def process_prompt(request_data: PromptRequest, request: Request):
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[request_data.prompt],
        )
        json_text = response.candidates[0].content.parts[0].text

        if json_text.startswith("```json"):
            json_text = json_text.replace("```json", "").replace("```", "").strip()

        data = json.loads(json_text)
        return JSONResponse(content=data)
    except Exception as error:
        return JSONResponse(status_code=500, content={"error": str(error)})
