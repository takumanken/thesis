"""Utility functions used across multiple modules in the application."""

import json
import logging
import os
from typing import Dict, List, Tuple, Any, Union

import numpy as np
import pandas as pd
import polars as pl

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
def extract_json_from_text(json_text: str) -> Tuple[Dict, bool]:
    """
    Extracts and parses JSON from text content, handling code blocks.
    
    Returns:
        Tuple of (parsed_json, is_valid_json)
    """
    is_json = json_text.strip().startswith("{") or "```json" in json_text
    
    if not is_json:
        return {}, False
    
    # Clean up JSON formatting if it's in a code block
    if "```json" in json_text:
        json_text = json_text.split("```json")[1].split("```")[0].strip()
    
    try:
        parsed_json = json.loads(json_text)
        return parsed_json, True
    except json.JSONDecodeError:
        return {}, False


# Setup logging
logger = logging.getLogger(__name__)