import logging
from typing import Dict, List, Tuple

from models import AggregationDefinition
from utils import classify_dimensions, TIME_DIMENSIONS, GEO_DIMENSIONS

logger = logging.getLogger(__name__)

# Constants
ADDITIVE_MEASURES = ["num_of_requests", "population"]

def is_measure_additive(measure_alias: str) -> bool:
    """
    Determines if a measure can be summed (is additive).
    """
    return measure_alias in ADDITIVE_MEASURES

def all_dimensions_exceed_cardinality(dimensions: list[str], dimension_stats: Dict[str, int], threshold: int = 15) -> bool:
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
        
        cardinality = dimension_stats.get(dim, 0)
        if cardinality <= threshold:
            return False
            
    return True

def is_topn_query(agg_def: AggregationDefinition) -> bool:
    """
    Determines if a query is a TOP N type query.
    """
    return hasattr(agg_def, 'topN') and agg_def.topN is not None

def get_viz_recommendations(agg_def: AggregationDefinition, dimension_stats: Dict[str, Dict[str, float]] = None, dataset_length: int = None) -> tuple[list[str], str]:
    """
    Determines available and ideal chart types based on the aggregation definition.
    
    Args:
        agg_def: The aggregation definition containing dimensions and measures
        dimension_stats: Statistics about dimensions (cardinality, etc.)
        dataset_length: The number of rows in the result dataset
        
    Returns:
        Tuple of (available_charts, ideal_chart)
    """

    if dataset_length == 1:
        logger.info("Single-row result detected: defaulting to table visualization")
        return ["table"], "table"
    
    available = ["table"]
    ideal = "table"
    
    dimensions = agg_def.dimensions or []
    measures = agg_def.measures or []
    
    time_dim, geo_dim, cat_dim = classify_dimensions(dimensions)
    logger.info(f"Dimensions: {dimensions}, Measures: {measures}, Time: {time_dim}, Geo: {geo_dim}, Cat: {cat_dim}")
    dim_count = len(dimensions)
    time_count = len(time_dim)
    geo_count = len(geo_dim)
    cat_count = len(cat_dim)
    measure_count = len(measures)
    
    additive_measure_count = sum(is_measure_additive(m["alias"]) for m in measures) if measures else 0
    
    # Check if this is a TOP N query
    is_topn = is_topn_query(agg_def)
    if is_topn:
        logger.info(f"Query identified as TOP N query with N={agg_def.topN.topN}")
    
    # Check for text response type first
    if hasattr(agg_def, 'response_type') and agg_def.response_type == "text":
        return ["text"], "text"
    
    # Empty data check
    if not dimensions and not measures:
        return available, ideal
    
    high_cardinality = dimension_stats and all_dimensions_exceed_cardinality(dimensions, dimension_stats)
    all_additive_measures = additive_measure_count == measure_count
    is_not_location = dimensions[0] != "location" if dimensions else True
    
    # Add chart types based on data characteristics
    if dim_count > 2 or measure_count == 0:
        return available, ideal # Just return table
    
    if cat_count == 1 and measure_count == 1 and time_count == 0 and is_not_location:
        available.append("single_bar_chart")
        ideal = "single_bar_chart"
    
    if time_count == 1 and measure_count == 1 and not high_cardinality:
        available.append("line_chart")
        ideal = "line_chart"
        if cat_count == 1 and additive_measure_count == measure_count:
            available.append("stacked_area_chart")
            available.append("stacked_area_chart_100")
    
    if 1 <= dim_count <= 2 and 1 <= measure_count <= 2 and (cat_count > 1 or measure_count > 1):
        available.append("nested_bar_chart")
        ideal = "nested_bar_chart"
    
    if cat_count == 2 and measure_count == 1 and not high_cardinality:
        available.append("grouped_bar_chart")
        ideal = "grouped_bar_chart"
    
        if additive_measure_count == measure_count:
            available.append("stacked_bar_chart")
            available.append("stacked_bar_chart_100")
            ideal = "stacked_bar_chart"
    
    # Only add treemap if not a TOP N query
    if 1 <= dim_count <= 2 and measure_count == 1 and time_count == 0 and all_additive_measures and is_not_location and not is_topn:
        available.append("treemap")
        
    if geo_count == 1 and len(dimensions) == 1 and measure_count == 1:
        geo_name = geo_dim[0].lower()
        if geo_name == "location":
            available.append("heatmap")
            available.remove("table")
            ideal = "heatmap"
        elif geo_name in ["borough", "county", "neighborhood_name", "incident_zip"]:
            available.append("choropleth_map")
            ideal = "choropleth_map"
    
    logger.info(f"Chart options: {available}, ideal: {ideal}")
    return available, ideal