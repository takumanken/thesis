import os
import json
import logging
from typing import Dict, List, Any, Optional
from google import genai
from google.genai import types

# Setup logging
logger = logging.getLogger(__name__)

# Global variables to store instruction and client
data_description_instruction = None
data_description_client = None

def get_data_description_client():
    """
    Initialize the Gemini API client for data descriptions lazily (only when needed).
    
    Returns:
        Tuple containing (system_instruction, client)
    """
    global data_description_instruction, data_description_client
    
    # If already initialized, return cached values
    if data_description_instruction and data_description_client:
        return data_description_instruction, data_description_client
    
    # Load system instruction
    with open("data_description_instruction.txt", "r") as f:
        data_description_instruction = f.read()
    
    # Initialize API client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable not set")
        raise ValueError("GEMINI_API_KEY is required")
    
    data_description_client = genai.Client(api_key=api_key)
    return data_description_instruction, data_description_client

def generate_data_description(
    original_query: str,
    dataset: List[Dict[str, Any]],
    aggregation_definition: Dict[str, Any],
    chart_type: str
) -> Dict[str, str]:
    """
    Generate a natural language description of the data and answer to the user's query.
    
    Args:
        original_query: The user's original natural language query
        dataset: The query results as a list of dictionaries
        aggregation_definition: The definition used to aggregate the data
        chart_type: The type of chart used to visualize the data
        
    Returns:
        Dictionary with dataDescription and directAnswer fields
    """
    # Get client (lazy initialization)
    try:
        system_instruction, client = get_data_description_client()
    except ValueError as e:
        logger.error(f"Failed to initialize data description client: {str(e)}")
        return {
            "dataDescription": "This data shows the results from NYC's 311 service request system.",
            "directAnswer": "The data has been aggregated as requested."
        }
    
    # Prepare a concise version of the dataset (first 10 rows)
    sample_data = dataset[:10] if dataset else []
    
    # Format input content for Gemini
    input_content = f"""
User Query: "{original_query}"

Chart Type: {chart_type}

Aggregation Definition:
{json.dumps(aggregation_definition, indent=2)}

Dataset Sample (showing {len(sample_data)} of {len(dataset)} rows):
{json.dumps(sample_data, indent=2)}
"""

    try:
        logger.info(f"Generating data description for query: '{original_query}'")
        
        # Call Gemini API for data description
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_instruction),
            contents=[input_content],
        )
        
        # Extract and parse the response
        response_text = response.candidates[0].content.parts[0].text
        logger.debug(f"Raw Gemini response: {response_text}")
        
        try:
            # Clean up the response text to extract JSON
            json_text = response_text.strip()
            
            # Handle markdown code blocks
            if "```json" in json_text:
                json_text = json_text.split("```json")[1].split("```")[0].strip()
            elif "```" in json_text:
                # Try to extract JSON from any code block
                json_text = json_text.split("```")[1].strip()
            
            # Try to find JSON object within the text using basic pattern matching
            if not json_text.startswith("{"):
                start_idx = json_text.find("{")
                end_idx = json_text.rfind("}")
                if start_idx != -1 and end_idx != -1:
                    json_text = json_text[start_idx:end_idx+1]
            
            logger.debug(f"Extracted JSON text: {json_text}")
            
            # Try to parse as JSON
            result = json.loads(json_text)
            
            # Validate required fields
            if "dataDescription" not in result or "directAnswer" not in result:
                logger.warning(f"Response missing required fields. Got: {list(result.keys())}")
                raise ValueError("Invalid response format")
                
            logger.info("JSON extracted and parsed successfully")
            
        except (json.JSONDecodeError, ValueError) as e:
            # If parsing fails, create a default response
            logger.warning(f"Failed to parse Gemini response as JSON: {str(e)}")
            logger.warning(f"Response text: {response_text[:200]}...")  # Log first 200 chars
            result = {
                "dataDescription": "This data shows the results from NYC's 311 service request system.",
                "directAnswer": "The data has been aggregated as requested."
            }
            
        logger.info("Data description generated successfully")
        return result
        
    except Exception as e:
        logger.error(f"Error generating data description: {str(e)}")
        return {
            "dataDescription": "This data shows the results from NYC's 311 service request system.",
            "directAnswer": "The data has been aggregated as requested."
        }