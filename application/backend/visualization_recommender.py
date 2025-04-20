import logging
from typing import Dict, List, Tuple

from models import AggregationDefinition

logger = logging.getLogger(__name__)

# Constants
TIME_DIMENSIONS = [
    "created_week", "closed_week", "created_date", "closed_date",
    "created_month", "closed_month", "created_year", "closed_year",
    "created_year_datepart", "created_month_datepart", "created_day_datepart",
    "created_hour_datepart", "closed_year_datepart", "closed_month_datepart", 
    "closed_day_datepart", "closed_hour_datepart"
]
GEO_DIMENSIONS = ["borough", "county", "location", "incident_zip", "neighborhood_name"]
ADDITIVE_MEASURES = ["num_of_requests"]

def classify_dimensions(dimensions: list[str]) -> tuple[list[str], list[str], list[str]]:
    """
    Categorizes dimensions into time, geographic, and categorical types.
    """
    time_dim = [dim for dim in dimensions if dim in TIME_DIMENSIONS]
    geo_dim = [dim for dim in dimensions if dim in GEO_DIMENSIONS]
    cat_dim = [dim for dim in dimensions if dim not in time_dim]
    return time_dim, geo_dim, cat_dim

def is_measure_additive(measure_alias: str) -> bool:
    """
    Determines if a measure can be summed (is additive).
    """
    return measure_alias in ADDITIVE_MEASURES

def all_dimensions_exceed_cardinality(dimensions: list[str], dimension_stats: Dict[str, Dict[str, float]], threshold: int = 15) -> bool:
    """
    Checks if all non-time dimensions exceed the cardinality threshold.
    """
    if not dimensions or not dimension_stats:
        return False
        
    non_time_dims = [dim for dim in dimensions if dim not in TIME_DIMENSIONS]
    if not non_time_dims:
        return False
        
    for dim in non_time_dims:
        if dim not in dimension_stats:
            continue
        
        cardinality = dimension_stats[dim].get("total_unique", 0)
        if cardinality <= threshold:
            return False
            
    return True

def get_chart_options(agg_def: AggregationDefinition, dimension_stats: Dict[str, Dict[str, float]] = None) -> tuple[list[str], str]:
    """
    Determines available and ideal chart types based on the aggregation definition.
    """
    available = ["table"]
    ideal = "table"
    
    dimensions = agg_def.dimensions or []
    measures = agg_def.measures or []
    
    time_dim, geo_dim, cat_dim = classify_dimensions(dimensions)
    dim_count = len(dimensions)
    time_count = len(time_dim)
    geo_count = len(geo_dim)
    cat_count = len(cat_dim)
    measure_count = len(measures)
    
    additive_measure_count = sum(is_measure_additive(m["alias"]) for m in measures) if measures else 0
    
    # Check for text response type first
    if hasattr(agg_def, 'response_type') and agg_def.response_type == "text":
        return ["text"], "text"
    
    # Empty data check
    if not dimensions and not measures:
        return available, ideal
    
    high_cardinality = dimension_stats and all_dimensions_exceed_cardinality(dimensions, dimension_stats)
    all_additive_measures = additive_measure_count == measure_count
    
    # Add chart types based on data characteristics
    if cat_count == 1 and measure_count == 1 and time_count == 0 and dimensions[0] != "location":
        available.append("single_bar_chart")
        ideal = "single_bar_chart"
    
    if time_count == 1 and cat_count <= 1 and measure_count == 1 and not high_cardinality:
        available.append("line_chart")
        ideal = "line_chart"
        if additive_measure_count == measure_count:
            available.append("stacked_area_chart")
            available.append("stacked_area_chart_100")
            ideal = "stacked_area_chart"
    
    if 1 <= cat_count <= 2 and 1 <= measure_count <= 2 and (cat_count > 1 or measure_count > 1):
        available.append("nested_bar_chart")
        ideal = "nested_bar_chart"
    
    if cat_count == 2 and measure_count == 1 and not high_cardinality:
        available.append("grouped_bar_chart")
        ideal = "grouped_bar_chart"
    
        if additive_measure_count == measure_count:
            available.append("stacked_bar_chart")
            available.append("stacked_bar_chart_100")
            ideal = "stacked_bar_chart"
    
    if 1 <= cat_count <= 2 and measure_count == 1 and time_count == 0 and all_additive_measures:
        available.append("treemap")
        
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1 and all_additive_measures:
        geo_name = geo_dim[0].lower()
        if geo_name == "location":
            available.append("heatmap")
            available.remove("table")
            ideal = "heatmap"
        elif geo_name in ["borough", "county", "neighborhood_name"]:
            available.append("choropleth_map")
            ideal = "choropleth_map"
        
    # Ensure unique chart types
    available = list(dict.fromkeys(available))
    logger.info(f"Chart options: {available}, ideal: {ideal}")
    return available, ideal