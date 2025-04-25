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
        instruction_path = "gemini_instructions/data_description_instruction.md"
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
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0),
            contents=[prompt],
        )
            
        # Extract response text
        response_text = response.candidates[0].content.parts[0].text
        logger.info(f"Response from Gemini: {response_text}")
        
        # Parse JSON, handling different formats
        result = extract_json(response_text)
        
        # Ensure we have all expected fields with defaults
        defaults = {
            "title": "Data Overview",
            "dataDescription": "Here is a summary of the requested data.",
            "filter_description": []
        }
        
        # Apply defaults for any missing fields
        for key, default_value in defaults.items():
            if key not in result:
                result[key] = default_value
                            
        return result
            
    except Exception as e:
        logger.error(f"Error generating data description: {e}", exc_info=True)
        return {
            "title": "Data Overview",
            "dataDescription": "Here is a summary of the requested data.",
            "filter_description": []
        }

def remove_date_filters(filter_descriptions):
    """Remove filter descriptions related to created_date fields"""
    if not isinstance(filter_descriptions, list):
        return filter_descriptions
    
    # Filter out both created_date and createdDateRange items
    return [
        item for item in filter_descriptions
        if isinstance(item, str) or
        not any(date_term in (item.get('filtered_field_name', '') + item.get('field', '')).lower() 
                for date_term in ['created_date', 'createddaterange'])
    ]

def extract_json(text: str) -> Dict[str, Any]:
    """Extract JSON from text, handling code blocks"""
    try:
        clean_text = text.strip()
        if "```" in clean_text:
            for block in ["```json", "```"]:
                if block in clean_text:
                    clean_text = clean_text.split(block, 1)[1]
                    break
            if "```" in clean_text:
                clean_text = clean_text.split("```", 1)[0]
                
        clean_text = clean_text.strip()
        result = json.loads(clean_text)
        logger.info(f"Successfully parsed JSON result with keys: {list(result.keys())}")
        return result
    except Exception as e:
        logger.warning(f"Failed to parse JSON response: {e}")
        return {}
