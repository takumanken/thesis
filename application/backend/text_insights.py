import os
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

from google import genai
from google.genai import types

# Single client instance
gemini_client = None

# Add a custom JSON encoder to handle non-serializable objects
class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles TopNDefinition and other custom objects"""
    def default(self, obj):
        # Handle objects with __dict__ attribute (like TopNDefinition)
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        # Handle any other special cases
        return super().default(obj)


def get_gemini_client():
    """Initialize and return the Gemini client"""
    global gemini_client
    if gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        gemini_client = genai.Client(api_key=api_key)
    return gemini_client


def generate_data_description(
    request_id: str,
    original_query: str,
    dataset: List[Dict[str, Any]],
    aggregation_definition: Dict[str, Any],
    chart_type: str
) -> Dict[str, Any]:
    """Generate a user-friendly description of data and chart"""
    try:
        # Load system instruction
        instruction_path = "gemini_instructions/data_description_instruction.md"
        with open(instruction_path, "r") as f:
            system_instruction = f.read()
            
        # Sample dataset to reduce tokens
        sample_size = min(100, len(dataset))
        sample_data = dataset[:sample_size]
        
        # Use custom encoder to handle TopNDefinition objects
        prompt = f"""
User Query: "{original_query}"
Chart Type: {chart_type}

Aggregation Definition:
{json.dumps(aggregation_definition, indent=2, cls=CustomJSONEncoder)}

Dataset Sample ({sample_size} of {len(dataset)} rows):
{json.dumps(sample_data, indent=2)}
"""

        # Call Gemini API
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-04-17",
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0),
            contents=[prompt],
        )
            
        # Extract response text
        response_text = response.candidates[0].content.parts[0].text
        logger.info(f"[{request_id}] Generated data description")
        
        # Parse JSON, handling different formats
        result = extract_json(response_text)
        
        # Ensure we have all expected fields with defaults
        defaults = {
            "title": "Data Overview",
            "dataDescription": "Here is a summary of the requested data.",
            "filterDescription": []
        }
        
        # Apply defaults for any missing fields
        for key, default_value in defaults.items():
            if key not in result:
                result[key] = default_value
                            
        return result
            
    except Exception as e:
        logger.error(f"[{request_id}] Error generating data description: {e}", exc_info=True)
        return {
            "title": "Data Overview",
            "dataDescription": "Here is a summary of the requested data.",
            "filterDescription": []
        }


def extract_json(text: str) -> Dict[str, Any]:
    """Extract JSON from text, handling code blocks"""
    try:
        clean_text = text.strip()
        if "```" in clean_text:
            for block in ["```json", "```"]:
                if block in clean_text:
                    clean_text = clean_text.split(block, 1)[1]
                    break
            if "```" in clean_text:
                clean_text = clean_text.split("```", 1)[0]
                
        clean_text = clean_text.strip()
        result = json.loads(clean_text)
        logger.info(f"Successfully parsed JSON result with keys: {list(result.keys())}")
        return result
    except Exception as e:
        logger.warning(f"Failed to parse JSON response: {e}")
        return {}


def extract_filter_fields(data_description: Dict[str, Any]) -> List[str]:
    """Extract field names from filter descriptions"""
    filter_fields = []
    if data_description.get("filterDescription"):
        for filter_desc in data_description.get("filterDescription", []):
            if isinstance(filter_desc, dict) and "filteredFieldName" in filter_desc:
                filter_fields.append(filter_desc["filteredFieldName"])
    return filter_fields


def collect_metadata(fields: List[str], data_schema: Dict[str, Any]) -> Tuple[List[Dict], List[Dict]]:
    """Collect metadata for fields and their associated data sources"""
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


def prepare_field_metadata(agg_def, visible_fields, data_schema):
    """Collect metadata for fields and data sources"""
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
        'statistics': {}  # Will be populated by caller if needed
    }
    
    return field_metadata, datasource_metadata, descriptor_agg_def


def generate_data_insights_complete(
    request_id: str,
    original_query: str,
    dataset: List[Dict[str, Any]],
    agg_def: Any,
    chart_type: str,
    query_metadata: Dict[str, Any],
    data_schema: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate complete data insights with metadata enhancement
    
    This function:
    1. Prepares field metadata
    2. Generates data description
    3. Enhances metadata with filter fields
    4. Returns a complete results object
    
    Args:
        request_id: Unique identifier for this request
        original_query: The user's original query text
        dataset: The result dataset
        agg_def: Aggregation definition object
        chart_type: The visualization type
        query_metadata: Additional metadata from query execution
        data_schema: Complete data schema
        
    Returns:
        Dict containing insights and enhanced aggregation definition
    """
    # 1. Prepare field metadata
    visible_fields = agg_def.dimensions + [field["alias"] for field in agg_def.measures]
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
        'statistics': {}  # Will be populated by caller if needed
    }
    
    # 2. Add query statistics if available
    if 'statistics' in query_metadata:
        descriptor_agg_def['statistics'] = query_metadata['statistics']
    
    # 3. Generate data insights/description
    data_description = generate_data_description(
        request_id=request_id,
        original_query=original_query, 
        dataset=dataset,
        aggregation_definition=descriptor_agg_def,
        chart_type=chart_type
    )
    
    # 4. Structure insights
    data_insights = {
        "title": data_description.get("title"),
        "dataDescription": data_description.get("dataDescription"),
        "filterDescription": data_description.get("filterDescription", [])
    }
    
    # 5. Enhance metadata with filter fields
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
    
    # 6. Return complete results
    return {
        "dataInsights": data_insights,
        "enhancedAggDef": agg_def
    }


def remove_date_filters(filterDescriptions):
    """Remove filter descriptions related to created_date fields"""
    if not isinstance(filterDescriptions, list):
        return filterDescriptions
    
    # Filter out both created_date and createdDateRange items
    return [
        item for item in filterDescriptions
        if isinstance(item, str) or
        not any(date_term in (item.get('filteredFieldName', '') + item.get('field', '')).lower() 
                for date_term in ['created_date', 'createddaterange'])
    ]
