"""
Query Translator Module

This module translates natural language queries about NYC 311 data
into structured query definitions for the database engine.
"""

# Standard library imports
import json
import logging
import os
from typing import Any, Dict, Optional, Tuple, Union

# Third-party library imports
from fastapi import HTTPException
from google import genai
from google.genai import types

# Local imports
from utils import BASE_DIR, DATA_SCHEMA_FILE, get_gemini_client, call_gemini_async

# === CONSTANTS ===
INSTRUCTION_FILE = os.path.join(BASE_DIR, "gemini_instructions/query_translation_instruction.md")

# === GLOBAL CONFIGURATION ===
logger = logging.getLogger(__name__)

# Module state
_client = None
_system_instruction = None
_schema = None
_initialized = False


# === INITIALIZATION ===
def _initialize():
    """
    Initialize the query translator with API client and instructions.
    
    This function loads the system instruction, data schema, and API client.
    It runs only once during the module lifetime and caches the results.
    """
    global _client, _system_instruction, _schema, _initialized
    
    if _initialized:
        return
    
    # Load API client
    _client = get_gemini_client()
    
    # Load system instruction
    with open(INSTRUCTION_FILE, "r") as f:
        _system_instruction = f.read()
    
    # Load schema
    with open(DATA_SCHEMA_FILE, "r") as f:
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


# === CONTEXT HANDLING ===
def _prepare_context_prompt(context: Optional[Dict[str, Any]]) -> str:
    """
    Prepare a context prompt string from conversation history and visualization state.
    
    Args:
        context: Dictionary containing conversation history and current visualization
        
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


# === QUERY TRANSLATION ===
async def translate_query(raw_query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[str, bool]:
    """Translate natural language query into a structured aggregation definition."""
    _initialize()
    
    try:
        # Prepare context prompt if available
        context_prompt = _prepare_context_prompt(context)
        
        # Combine query and context
        if context_prompt:
            full_prompt = f"{raw_query}\n\nCONTEXT:\n{context_prompt}"
        else:
            full_prompt = raw_query
        
        # Log basic query info
        query_preview = raw_query[:50] + "..." if len(raw_query) > 50 else raw_query
        logger.info(f"Translating query: {query_preview}")
        
        # Use the async wrapper
        response = await call_gemini_async(
            "gemini-2.0-flash",
            full_prompt,
            config=types.GenerateContentConfig(
                system_instruction=_system_instruction,
                temperature=0,
            )
        )
        
        # Extract response text
        response_text = response.candidates[0].content.parts[0].text.strip()
        
        # Check if this is a direct response
        if response_text.strip().startswith("DIRECT_RESPONSE:"):
            direct_response = response_text[len("DIRECT_RESPONSE:"):].strip()
            logger.info("Query translator provided direct response")
            return direct_response, True
            
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