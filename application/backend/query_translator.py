import json
import logging
import os
from google import genai
from google.genai import types

# Setup logging
logger = logging.getLogger(__name__)

# Constants
INSTRUCTION_FILE = "gemini_instructions/query_translation_instruction.md"
FILTER_VALUES_FILE = "gemini_instructions/references/all_filters.json"
DATA_SCHEMA_FILE = "data/data_schema.json"

# Cache for loaded resources
_instruction_template = None
_client = None
_all_filters = None
_data_schema = None

def _initialize():
    """Initialize the translator with required resources"""
    global _instruction_template, _client, _all_filters, _data_schema
    
    # Only initialize once
    if _instruction_template is not None:
        return
    
    # Load instruction template
    with open(INSTRUCTION_FILE, "r") as f:
        _instruction_template = f.read()
    
    # Load filter values
    with open(FILTER_VALUES_FILE, "r") as f:
        _all_filters = json.load(f)
    
    # Load data schema
    with open(DATA_SCHEMA_FILE, "r") as f:
        _data_schema = json.load(f)
    
    # Initialize Gemini client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable not set")
        raise ValueError("GEMINI_API_KEY is required")
    
    _client = genai.Client(api_key=api_key)
    logger.info("Query translator initialized")

def translate_query(user_query, current_context=None):
    """
    Translate a natural language query into structured guidance for data aggregation,
    or provide a direct response for non-aggregation questions.
    
    Args:
        user_query: The natural language question from the user
        current_context: Optional context about what the user is currently viewing
        
    Returns:
        Tuple containing (response_text, is_direct_response)
    """
    # Ensure resources are initialized
    _initialize()
    
    try:
        # Prepare the system instruction with actual data
        system_instruction = _instruction_template.replace(
            "{all_filters}", json.dumps(_all_filters)
        ).replace(
            "{data_schema}", json.dumps(_data_schema)
        )
        
        # Create the prompt with better formatting
        context_json = json.dumps(current_context, indent=2)
        context_section = f"# CURRENT CONTEXT\n```json\n{context_json}\n```"
            
        prompt = f"""
{context_section}

# USER QUERY
"{user_query}"
"""
        
        # Call Gemini API with the prepared instruction
        gemini_model = "gemini-2.0-flash"
        response = _client.models.generate_content(
            model=gemini_model,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction, 
                temperature=0
            ),
            contents=[prompt],
        )
        
        # Get the response text
        translation = response.candidates[0].content.parts[0].text
        logger.info(f"Query translation generated: {translation}...")
        
        # Check if this is a direct response
        if translation.strip().startswith("DIRECT_RESPONSE:"):
            direct_response = translation[len("DIRECT_RESPONSE:"):].strip()
            logger.info("Query translator provided direct response")
            return direct_response, True
        
        # Normal caveats case
        return translation, False
        
    except Exception as e:
        logger.error(f"Error translating query: {str(e)}")
        return f"Error: {str(e)}", False