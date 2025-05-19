"""
Query Translator Module

This module translates natural language queries about NYC 311 data
into structured query definitions for the database engine.
"""
import os
import json
import logging
from typing import Tuple, Dict, Any, Optional, Union

from fastapi import HTTPException
from google import genai
from google.genai import types

# Configure logging
logger = logging.getLogger(__name__)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTRUCTION_FILE = os.path.join(BASE_DIR, "gemini_instructions/query_translation_instruction.md")
SCHEMA_FILE = os.path.join(BASE_DIR, "data/data_schema.json")

# Module variables
_client = None
_system_instruction = None
_schema = None
_initialized = False


def _initialize():
    """Initialize the query translator with API client and instructions"""
    global _client, _system_instruction, _schema, _initialized
    
    if _initialized:
        return
    
    # Load API client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is required")
    _client = genai.Client(api_key=api_key)
    
    # Load system instruction
    with open(INSTRUCTION_FILE, "r") as f:
        _system_instruction = f.read()
    
    # Load schema
    with open(SCHEMA_FILE, "r") as f:
        _schema = json.load(f)
    
    # Generate simplified schema (no user descriptions)
    simplified_schema = {}
    if _schema:
        simplified_schema = {
            "dimensions": {
                dim_type: [{k: v for k, v in dim.items() if k != "description_to_user"} 
                          for dim in dims]
                for dim_type, dims in _schema["dimensions"].items()
            },
            "measures": [{k: v for k, v in m.items() if k != "description_to_user"} 
                        for m in _schema["measures"]]
        }
    
    # Replace placeholders in the instruction
    _system_instruction = _system_instruction.replace(
        "{data_schema}", json.dumps(simplified_schema)
    )
    
    _initialized = True
    logger.info("Query translator initialized")


def _prepare_context_prompt(context: Optional[Dict[str, Any]]) -> str:
    """
    Prepare a context prompt string from context information.
    
    Args:
        context: Dict containing conversation history and current visualization
        
    Returns:
        Formatted context string for the prompt
    """
    if not context:
        return ""
    
    prompt_parts = []
    
    # Add current visualization context if available
    current_viz = context.get("currentVisualization")
    if current_viz and current_viz.get("chartType") != "text":
        chart_type = current_viz.get("chartType", "")
        dimensions = current_viz.get("dimensions", [])
        measures = current_viz.get("measures", [])
        
        if dimensions or measures:
            prompt_parts.append("Current visualization:")
            prompt_parts.append(f"- Chart type: {chart_type}")
            
            if dimensions:
                prompt_parts.append(f"- Dimensions: {', '.join(dimensions)}")
            
            measure_names = []
            for m in measures:
                if isinstance(m, dict) and "alias" in m:
                    measure_names.append(m["alias"])
                elif isinstance(m, str):
                    measure_names.append(m)
            
            if measure_names:
                prompt_parts.append(f"- Measures: {', '.join(measure_names)}")
    
    # Add conversation history if available
    history = context.get("conversationHistory", [])
    if history:
        prompt_parts.append("\nRecent conversation:")
        # Add last 3 exchanges at most
        for entry in history[-3:]:
            if entry.get("role") == "user":
                prompt_parts.append(f"User: {entry.get('content', '')}")
            else:
                prompt_parts.append(f"Assistant: {entry.get('content', '')}")
    
    return "\n".join(prompt_parts)


def translate_query(raw_query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[str, bool]:
    """
    Translate natural language query into a structured aggregation definition.
    
    Args:
        raw_query: The user's natural language query
        context: Optional context information (conversation history, current viz)
        
    Returns:
        Tuple of (response_text, is_direct_response)
        - If is_direct_response is True, response_text is a message to show directly
        - Otherwise, response_text is JSON to pass to the query engine
    """
    _initialize()
    
    try:
        # Prepare context prompt if available
        context_prompt = _prepare_context_prompt(context)
        
        # Combine query and context
        if context_prompt:
            full_prompt = f"{raw_query}\n\nCONTEXT:\n{context_prompt}"
        else:
            full_prompt = raw_query
        
        # Log basic query info but not full content for privacy
        query_preview = raw_query[:50] + "..." if len(raw_query) > 50 else raw_query
        logger.info(f"Translating query: {query_preview}")
        
        # Call the Gemini API with full prompt
        response = _client.models.generate_content(
            model="gemini-2.5-flash-preview-04-17",
            config=types.GenerateContentConfig(
                system_instruction=_system_instruction,
                temperature=0,
            ),
            contents=[full_prompt],
        )
        
        # Extract response text
        response_text = response.candidates[0].content.parts[0].text.strip()
        
        # Check if this is a direct response (non-query response)
        if response_text.strip().startswith("DIRECT_RESPONSE:"):
            direct_response = response_text[len("DIRECT_RESPONSE:"):].strip()
            logger.info("Query translator provided direct response")
            return direct_response, True
        
        # For safety message check - this additional check can help detect hidden error cases
        if response_text.strip() == "I can only answer questions about NYC 311 data":
            logger.info("Query translator returned safety message")
            return response_text, True
            
        # Log success and return the structured query definition
        logger.debug(f"Query translation successful, response length: {len(response_text)}")
        return response_text, False
        
    except genai.errors.ClientError as err:
        # Handle Gemini API errors with specific status codes
        logger.error(f"Gemini API error: {str(err)}")
        status = getattr(err, "status_code", 500)
        
        # Create appropriate error message based on status
        if status == 429:
            error_msg = "Rate limit exceeded. Please try again later."
        else:
            error_msg = "The AI service encountered an error. Please try again later."
            
        raise HTTPException(status_code=status, detail={"error": error_msg})
        
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Error translating query: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": "An error occurred processing your request."}
        )


if __name__ == "__main__":
    # Simple test to run the module directly
    logging.basicConfig(level=logging.INFO)
    try:
        result, is_direct = translate_query("Show me noise complaints in Manhattan")
        print(f"Is direct response: {is_direct}")
        print(result)
    except Exception as e:
        print(f"Error: {e}")