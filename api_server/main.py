from fastapi import FastAPI
from pydantic import BaseModel
import duckdb

app = FastAPI()

# Define the structure of the input
class Item(BaseModel):
    prompt: str

@app.post("/process")
async def process_item(item: Item):

    prompt = item.prompt
    result = prompt + " was received."
    
    # Return the response
    return result
