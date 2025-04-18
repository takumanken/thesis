import os
import json
import logging
from typing import Dict, List, Any
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Global variables
data_description_instruction = None
data_description_client = None

def get_data_description_client():
    global data_description_instruction, data_description_client
    
    # Return cached values if already initialized
    if data_description_instruction is not None and data_description_client is not None:
        return data_description_instruction, data_description_client
        
    # Get API key
    api_key = os.getenv("GEMINI_API_KEY")
    
    # Load instruction and initialize client
    with open("data_description_instruction.txt", "r") as f:
        data_description_instruction = f.read()
    
    data_description_client = genai.Client(api_key=api_key)
    return data_description_instruction, data_description_client

def generate_data_description(
    original_query: str,
    dataset: List[Dict[str, Any]],
    aggregation_definition: Dict[str, Any],
    chart_type: str
) -> Dict[str, str]:
    """Generates a description of the data using Gemini API."""
    try:
        system_instruction, client = get_data_description_client()
        
        # Use sample of dataset to avoid token limits
        sample_size = min(100, len(dataset))
        sample_data = dataset[:sample_size]
        
        # Extract date range information if available
        date_context = ""
        if "createdDateRange" in aggregation_definition and aggregation_definition["createdDateRange"]:
            date_range = aggregation_definition["createdDateRange"]
            if len(date_range) == 2:
                date_context = f"""
Date Context:
Date range (311 request created date) is from {date_range[0]} to {date_range[1]}
"""
        
        # Format input for Gemini
        input_content = f"""
User Query: "{original_query}"
Chart Type: {chart_type}
{date_context}
Aggregation Definition:
{json.dumps(aggregation_definition, indent=2)}
Dataset Sample ({sample_size} of {len(dataset)} rows):
{json.dumps(sample_data, indent=2)}
"""

        # Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[input_content],
        )
        
        # Extract response text
        response_text = response.candidates[0].content.parts[0].text
        
        # Extract JSON from response
        json_text = response_text.strip()
        if "```json" in json_text:
            json_text = json_text.split("```json")[1].split("```")[0].strip()
        elif "```" in json_text:
            json_text = json_text.split("```")[1].split("```")[0].strip()
        
        # Parse response
        result = json.loads(json_text)
            
        return result
            
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse JSON response: {e}")
        return {"title": "Data Overview", "dataDescription": "Here is a summary of the requested data."}
    except Exception as e:
        logger.error(f"Error generating data description: {e}")
        return {"title": "Data Overview", "dataDescription": "Here is a summary of the requested data."}
