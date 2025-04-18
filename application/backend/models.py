from typing import List, Dict, Optional
from pydantic import BaseModel

class PromptRequest(BaseModel):
    """
    Request model for the /process endpoint.
    Contains the user's prompt text and optional location data.
    """
    prompt: str
    location: Optional[Dict[str, float]] = None

class AggregationDefinition(BaseModel):
    """
    Defines the structure of a data aggregation query.
    Contains dimensions, measures, and filters for aggregation operations.
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