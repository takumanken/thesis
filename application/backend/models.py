"""
NYC 311 Data Explorer Models

This module defines the data models used throughout the application,
including request/response structures and data aggregation definitions.
"""

# Standard library imports
from typing import Any, Dict, List, Optional

# Third-party imports
from pydantic import BaseModel

# === DATA DEFINITION MODELS ===
class TopNDefinition(BaseModel):
    """
    Defines the structure for TOP N queries.
    Contains ordering keys and number of records to return.
    """
    orderByKey: List[str]
    topN: int


# === VISUALIZATION MODELS ===
class CurrentVisualization(BaseModel):
    """
    Represents the current visualization state in the frontend.
    Contains chart type, dimensions, measures, and filters.
    """
    chartType: str
    dimensions: List[str] = []
    measures: List[Dict[str, str]] = []
    preAggregationFilters: str = ""
    postAggregationFilters: str = ""
    topN: Optional[TopNDefinition] = None


# === CONVERSATION MODELS ===
class ConversationContext(BaseModel):
    """
    Contains the current visualization context and conversation history.
    Used to maintain state between user interactions.
    """
    currentVisualization: CurrentVisualization
    conversationHistory: List[Dict[str, Any]] = []


# === API REQUEST MODELS ===
class PromptRequest(BaseModel):
    """
    Request model for the /process endpoint.
    Contains the user's prompt text, optional context, and optional location data.
    """
    prompt: str
    context: Optional[ConversationContext] = None
    location: Optional[Dict[str, float]] = None


# === DATA QUERY MODELS ===
class AggregationDefinition(BaseModel):
    """
    Defines the structure of a data aggregation query.
    Contains dimensions, measures, and filters for aggregation operations.
    
    This is the central data model that drives SQL generation, visualization 
    selection, and insight generation.
    """
    dimensions: List[str]
    measures: List[Dict[str, str]]
    preAggregationFilters: str = ""
    postAggregationFilters: str = ""
    timeDimension: List[str] = []
    geoDimension: List[str] = []
    categoricalDimension: List[str] = []
    response_type: str = "data"
    createdDateRange: Optional[List[str]] = None
    datasourceMetadata: Optional[List[dict]] = None
    fieldMetadata: Optional[List[dict]] = None
    topN: Optional[TopNDefinition] = None