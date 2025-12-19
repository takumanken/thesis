2"""
Text Insights Generator

Generates human-readable insights and descriptions for NYC 311 data
based on query results, dataset statistics, and visualization types.
"""

# Standard library imports
import json
import logging
import os
from typing import Dict, List, Any, Optional, Tuple

# Third-party imports
from google.genai import types

# Local imports
from models import AggregationDefinition
from utils import (
    BASE_DIR, extract_json, CustomJSONEncoder, 
    call_gemini_async, gemini_safe
)

# === CONSTANTS ===
INSIGHTS_INSTRUCTION_FILE = os.path.join(BASE_DIR, "gemini_instructions/data_description_instruction.md")
MAX_SAMPLE_SIZE = 100

# === GLOBAL CONFIGURATION ===
logger = logging.getLogger(__name__)


# === METADATA HANDLING ===
def collect_metadata(fields: List[str], data_schema: Dict[str, Any]) -> Tuple[List[Dict], List[Dict]]:
    """
    Collect metadata for fields and their associated data sources.
    
    Args:
        fields: List of field names to collect metadata for
        data_schema: Complete schema definition containing field and data source information
        
    Returns:
        Tuple of (field_metadata, datasource_metadata)
    """    
    # Get all field descriptions from schema
    all_field_descriptions = (
        data_schema["dimensions"]["time_dimension"] + 
        data_schema["dimensions"]["geo_dimension"] + 
        data_schema["dimensions"]["categorical_dimension"] + 
        data_schema["measures"]
    )

    # Match fields to their metadata
    field_metadata = []
    for field in fields:
        for field_description in all_field_descriptions:
            if field_description["physical_name"] == field:
                field_desc_copy = field_description.copy()
                field_desc_copy.pop("synonym", None)  # Remove redundant synonym info
                field_metadata.append(field_desc_copy)
    
    # Build set of unique data source IDs referenced by fields
    used_datasources = set(
        field['data_source_id'] 
        for field in field_metadata 
        if 'data_source_id' in field
    )
    
    # Collect metadata for each data source
    datasource_metadata = []
    for used_datasource in used_datasources:
        for datasource in data_schema["data_sources"]:
            if datasource["data_source_id"] == used_datasource:
                datasource_metadata.append(datasource)
                
    return field_metadata, datasource_metadata


def prepare_field_metadata(
    agg_def: AggregationDefinition, 
    visible_fields: List[str], 
    data_schema: Dict[str, Any]
) -> Tuple[List[Dict], List[Dict], Dict[str, Any]]:
    """
    Prepare enhanced field metadata for insights generation.
    
    Args:
        agg_def: Aggregation definition containing query structure
        visible_fields: List of fields visible in the result set
        data_schema: Complete schema definition
        
    Returns:
        Tuple of (field_metadata, datasource_metadata, descriptor_agg_def)
    """
    # Collect basic metadata for visible fields
    field_metadata, datasource_metadata = collect_metadata(visible_fields, data_schema)
    
    # Create descriptor aggregation definition
    descriptor_agg_def = {
        'dimensions': agg_def.dimensions,
        'measures': agg_def.measures,
        'preAggregationFilters': agg_def.preAggregationFilters,
        'postAggregationFilters': agg_def.postAggregationFilters,
        'topN': getattr(agg_def, 'topN', None),
        'createdDateRange': getattr(agg_def, 'createdDateRange', []),
        'datasourceMetadata': datasource_metadata,
        'fieldMetadata': field_metadata,
        'statistics': {}
    }
    
    return field_metadata, datasource_metadata, descriptor_agg_def


# === FILTERING HELPERS ===
def extract_filter_fields(data_description: Dict[str, Any]) -> List[str]:
    """
    Extract field names from filter descriptions.
    
    Args:
        data_description: Data description containing filter information
        
    Returns:
        List of field names that are mentioned in filters
    """
    filter_fields = []
    if data_description.get("filterDescription"):
        for filter_desc in data_description.get("filterDescription", []):
            if isinstance(filter_desc, dict) and "filteredFieldName" in filter_desc:
                filter_fields.append(filter_desc["filteredFieldName"])
    return filter_fields


def remove_date_filters(filter_descriptions: List[Any]) -> List[Any]:
    """
    Remove filter descriptions related to date fields to avoid redundancy.
    
    Args:
        filter_descriptions: List of filter description objects
        
    Returns:
        Filtered list with date-related filters removed
    """
    if not isinstance(filter_descriptions, list):
        return filter_descriptions
    
    # Filter out both created_date and createdDateRange items
    return [
        item for item in filter_descriptions
        if isinstance(item, str) or
        not any(date_term in (item.get('filteredFieldName', '') + item.get('field', '')).lower() 
                for date_term in ['created_date', 'createddaterange'])
    ]


# === INSIGHT GENERATION ===
@gemini_safe
async def generate_data_description(
    original_query: str,
    dataset: List[Dict[str, Any]],
    aggregation_definition: Dict[str, Any],
    chart_type: str
) -> Dict[str, Any]:
    """
    Generate a user-friendly description of data and chart.
    
    Args:
        original_query: The original natural language query
        dataset: The result dataset to analyze
        aggregation_definition: The structured query definition with metadata
        chart_type: The visualization type used
        
    Returns:
        Dictionary with insight components (title, description, filter descriptions)
    """
    # Load system instruction
    with open(INSIGHTS_INSTRUCTION_FILE, "r") as f:
        system_instruction = f.read()
        
    # Sample dataset to reduce tokens
    sample_size = min(MAX_SAMPLE_SIZE, len(dataset))
    sample_data = dataset[:sample_size]
    
    # Prepare prompt
    prompt = f"""
User Query: "{original_query}"
Chart Type: {chart_type}

Aggregation Definition:
{json.dumps(aggregation_definition, indent=2, cls=CustomJSONEncoder)}

Dataset Sample ({sample_size} of {len(dataset)} rows):
{json.dumps(sample_data, indent=2)}
"""

    # Call Gemini API
    response = await call_gemini_async(
        "gemini-2.5-flash-lite",
        prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction, 
            temperature=0
        )
    )
    
    # Extract and parse response
    response_text = response.candidates[0].content.parts[0].text
    logger.info("Generated data description")
    result = extract_json(response_text)
    
    return result


async def generate_data_insights_complete(
    original_query: str,
    dataset: List[Dict[str, Any]],
    agg_def: AggregationDefinition,
    chart_type: str,
    query_metadata: Dict[str, Any],
    data_schema: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate complete data insights with metadata enhancement.
    
    Args:
        original_query: The original natural language query
        dataset: The result dataset to analyze
        agg_def: The structured aggregation definition
        chart_type: The visualization type used
        query_metadata: Additional metadata about the query execution
        data_schema: Complete schema definition
        
    Returns:
        Dictionary with enhanced insights and augmented aggregation definition
    """
    # 1. Prepare visible fields list
    visible_fields = agg_def.dimensions + [field["alias"] for field in agg_def.measures]
    
    # 2. Collect metadata and prepare enhanced aggregation definition
    field_metadata, datasource_metadata, descriptor_agg_def = prepare_field_metadata(
        agg_def, visible_fields, data_schema
    )
    
    # 3. Add query statistics if available
    if 'statistics' in query_metadata:
        descriptor_agg_def['statistics'] = query_metadata['statistics']
    
    # 4. Generate data description
    data_description = await generate_data_description(
        original_query=original_query, 
        dataset=dataset,
        aggregation_definition=descriptor_agg_def,
        chart_type=chart_type
    )
    
    # 5. Structure insights
    data_insights = {
        "title": data_description.get("title"),
        "dataDescription": data_description.get("dataDescription"),
        "filterDescription": data_description.get("filterDescription", [])
    }
    
    # 6. Enhance metadata with filter fields
    filter_fields = extract_filter_fields(data_insights)
    if filter_fields:
        all_fields = list(set(visible_fields + filter_fields))
        if len(all_fields) > len(visible_fields):
            field_metadata, datasource_metadata = collect_metadata(all_fields, data_schema)
            # Update aggregation definition with complete metadata
            agg_def = agg_def.copy(update={
                "datasourceMetadata": datasource_metadata,
                "fieldMetadata": field_metadata
            })
    
    # 7. Return complete results
    return {
        "dataInsights": data_insights,
        "enhancedAggDef": agg_def
    }
