"""Utility functions used across multiple modules in the application."""

import json
import logging
import os
from typing import Dict, List, Tuple, Any, Union

import pandas as pd
import polars as pl
from google import genai

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Common file paths used across modules
DATA_SCHEMA_FILE = os.path.join(BASE_DIR, "data/data_schema.json")

# Constants that might be used in multiple places
TIME_DIMENSIONS = [
    "created_week", "closed_week", "created_date", "closed_date",
    "created_month", "closed_month", "created_year", "closed_year",
    "created_year_datepart", "created_month_datepart", "created_day_datepart",
    "created_hour_datepart", "closed_year_datepart", "closed_month_datepart", 
    "closed_day_datepart", "closed_hour_datepart"
]
GEO_DIMENSIONS = ["borough", "county", "location", "incident_zip", "neighborhood_name"]


# === DIMENSION CLASSIFICATION ===
def classify_dimensions(dimensions: List[str]) -> Tuple[List[str], List[str], List[str]]:
    """
    Classify dimensions into time, geo, and categorical types.
    
    Args:
        dimensions: List of dimension names
        
    Returns:
        Tuple of (time_dimensions, geo_dimensions, categorical_dimensions)
    """
    time_dims = [d for d in dimensions if d in TIME_DIMENSIONS]
    geo_dims = [d for d in dimensions if d in GEO_DIMENSIONS]
    cat_dims = [d for d in dimensions if d not in TIME_DIMENSIONS]
    
    return time_dims, geo_dims, cat_dims


# === DATAFRAME CONVERSION ===
def convert_to_dataframe(dataset: List[Dict]) -> Union[pl.DataFrame, pd.DataFrame]:
    """Converts dataset to a DataFrame, using Polars if possible."""
    try:
        return pl.DataFrame(dataset)
    except Exception as e:
        logger.warning(f"Failed to use Polars: {str(e)}. Using pandas.")
        return pd.DataFrame(dataset)


# === JSON HANDLING ===
def extract_json(text: str, return_status: bool = False) -> Union[Dict[str, Any], Tuple[Dict[str, Any], bool]]:
    """
    Extracts and parses JSON from text content, handling markdown code blocks.
    
    Args:
        text: Text that may contain JSON, possibly within markdown code blocks
        return_status: Whether to return a tuple with success flag (for backward compatibility)
    
    Returns:
        If return_status=False: Parsed JSON dict or empty dict on failure
        If return_status=True: Tuple of (parsed_json, is_valid_json)
    """
    is_json = text.strip().startswith("{") or "```" in text
    
    if not is_json:
        return ({}, False) if return_status else {}
    
    # Clean up JSON formatting if it's in a code block
    clean_text = text.strip()
    if "```" in clean_text:
        # Handle different markdown formats
        for delimiter in ["```json", "```"]:
            if delimiter in clean_text:
                clean_text = clean_text.split(delimiter, 1)[1]
                break
                
        if "```" in clean_text:
            clean_text = clean_text.split("```", 1)[0]
    
    clean_text = clean_text.strip()
    
    try:
        parsed_json = json.loads(clean_text)
        logger.debug(f"Successfully parsed JSON with keys: {list(parsed_json.keys())}")
        return (parsed_json, True) if return_status else parsed_json
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse JSON: {e}")
        return ({}, False) if return_status else {}


class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles objects with __dict__ attribute."""
    def default(self, obj):
        # Handle objects with __dict__ attribute (like TopNDefinition)
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        # Handle any other special cases
        return super().default(obj)


# === GEMINI API CLIENT ===
_gemini_client = None

def get_gemini_client():
    """
    Initialize and return the Gemini client using a singleton pattern.
    
    Returns:
        genai.Client: Initialized Gemini API client
    """
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


# === LOGGING UTILITIES ===

def get_logger(name=None):
    """Get a logger with the given name"""
    return logging.getLogger(name or __name__)

# Configure basic logging setup
def configure_logging():
    """Configure basic logging for the application"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


# Setup logging
logger = logging.getLogger(__name__)