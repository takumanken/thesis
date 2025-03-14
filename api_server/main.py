from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import duckdb
import pandas as pd
from dotenv import load_dotenv

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
PUBLIC_BUCKET_URL = os.getenv("R2_PUBLIC_BUCKET_URL")
OBJECT_NAME = 'requests_311.parquet'
OBJECT_URL = f"{PUBLIC_BUCKET_URL}{OBJECT_NAME}"

# Define the structure of the input
class Item(BaseModel):
    prompt: str

@app.post("/process")
@limiter.limit("10/minute")
async def process_item(item: Item, request: Request):
    prompt = item.prompt.strip()

    try:
        con = duckdb.connect(database=':memory:')
        query = f"""
            SELECT *
            FROM read_parquet('{OBJECT_URL}')
            LIMIT 3
        """
        result_df = con.execute(query).fetchdf()
        result_data = result_df.to_dict(orient='records')
        con.close()
        return result_data

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
