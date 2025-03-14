from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import duckdb  # (Assuming you'll use it later)

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

# Define the structure of the input
class Item(BaseModel):
    prompt: str

@app.post("/process")
@limiter.limit("10/minute")
async def process_item(item: Item, request: Request):
    prompt = item.prompt

    # Basic input validation (optional but good practice)
    if not prompt.strip():
        return JSONResponse(status_code=400, content={"error": "Prompt cannot be empty."})

    result = f"{prompt} was received."

    # Return the response as JSON
    return {"response": result}
