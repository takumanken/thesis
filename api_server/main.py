from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import duckdb
from dotenv import load_dotenv
from google import genai

load_dotenv()
app = FastAPI()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://takumanken.github.io"],
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# Set Variables
PUBLIC_BUCKET_URL = "https://pub-cb6e94f4490c42b9b0c520e8116fb9b7.r2.dev/"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DB_FILE_NAME = "nyc_open_data.db"

client = genai.Client(api_key=GEMINI_API_KEY)
response = client.models.generate_content(
    model="gemini-2.0-flash", contents="1+1=?"
)

# Define the structure of the input
class Item(BaseModel):
    prompt: str

@app.post("/process")
@limiter.limit("10/minute")
async def process_item(item: Item, request: Request):

    try:
        con = duckdb.connect(DB_FILE_NAME)
        query_sample_record = "SELECT * FROM requests_311 LIMIT 1"
        result_df = con.execute(query_sample_record).fetchdf()
        result_data = result_df.to_dict(orient='records')
        con.close()

        return result_data

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
