import os
import json
import logging
from typing import Dict, List, Any, Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Single client instance
gemini_client = None

def get_gemini_client():
    """Initialize and return the Gemini client"""
    global gemini_client
    if gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        gemini_client = genai.Client(api_key=api_key)
    return gemini_client

def generate_data_description(
    original_query: str,
    dataset: List[Dict[str, Any]],
    aggregation_definition: Dict[str, Any],
    chart_type: str
) -> Dict[str, str]:
    """Generate a user-friendly description of data and chart"""
    try:
        # Load system instruction
        instruction_path = "assets/gemini_instructions/data_description_instruction.md"
        with open(instruction_path, "r") as f:
            system_instruction = f.read()
            
        # Sample dataset to reduce tokens
        sample_size = min(50, len(dataset))
        sample_data = dataset[:sample_size]
            
        # Build simple prompt with required information
        prompt = f"""
User Query: "{original_query}"
Chart Type: {chart_type}

Aggregation Definition:
{json.dumps(aggregation_definition, indent=2)}

Dataset Sample ({sample_size} of {len(dataset)} rows):
{json.dumps(sample_data, indent=2)}
"""

        # Call Gemini API
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[prompt],
        )
            
        # Extract response text
        response_text = response.candidates[0].content.parts[0].text
        
        # Parse JSON, handling different formats
        result = extract_json(response_text)
        
        # Ensure we have the expected fields
        if "title" not in result:
            result["title"] = "Data Overview"
        if "dataDescription" not in result:
            result["dataDescription"] = "Here is a summary of the requested data."
            
        return result
            
    except Exception as e:
        logger.error(f"Error generating data description: {e}", exc_info=True)
        return {
            "title": "Data Overview",
            "dataDescription": "Here is a summary of the requested data."
        }

def extract_json(text: str) -> Dict[str, str]:
    """Extract JSON from text, handling code blocks"""
    try:
        # Remove code block markers if present
        clean_text = text.strip()
        if "```" in clean_text:
            for block in ["```json", "```"]:
                if block in clean_text:
                    clean_text = clean_text.split(block, 1)[1]
                    break
            if "```" in clean_text:
                clean_text = clean_text.split("```", 1)[0]
                
        clean_text = clean_text.strip()
        return json.loads(clean_text)
    except:
        logger.warning("Failed to parse JSON response")
        return {}
