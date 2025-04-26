from typing import List, Dict, Optional, Any
from pydantic import BaseModel

class TopNDefinition(BaseModel):
    """
    Defines the structure for TOP N queries.
    Contains ordering keys and number of records to return.
    """
    orderByKey: List[str]
    topN: int

class CurrentVisualization(BaseModel):
    """
    Represents the current visualization state
    """
    chartType: str
    dimensions: List[str] = []
    measures: List[Dict[str, str]] = []
    preAggregationFilters: str = ""
    postAggregationFilters: str = ""
    topN: Optional[TopNDefinition] = None

class ConversationContext(BaseModel):
    """
    Contains the current visualization context and conversation history
    """
    currentVisualization: CurrentVisualization
    conversationHistory: List[Dict[str, Any]] = []

class PromptRequest(BaseModel):
    """
    Request model for the /process endpoint.
    Contains the user's prompt text, optional context, and optional location data.
    """
    prompt: str
    context: Optional[ConversationContext] = None
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
    datasourceMetadata: Optional[List[dict]] = None
    fieldMetadata: Optional[List[dict]] = None
    topN: Optional[TopNDefinition] = None