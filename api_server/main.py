from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import duckdb

app = FastAPI()

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://takumanken.github.io"],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# Define the structure of the input
class Item(BaseModel):
    prompt: str

@app.post("/process")
async def process_item(item: Item):
    prompt = item.prompt
    result = prompt + " was received."
    
    # Return the response as JSON
    return {"response": result}
