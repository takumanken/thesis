import json
import time
import logging
import duckdb
import pandas as pd
import polars as pl
import numpy as np
from typing import Dict, List, Tuple, Optional, Any

from models import AggregationDefinition
from visualization_recommender import TIME_DIMENSIONS, GEO_DIMENSIONS, classify_dimensions

logger = logging.getLogger(__name__)

def extract_json_from_text(json_text: str) -> tuple[dict, bool]:
    """
    Extracts and parses JSON from text content, handling code blocks.
    
    Args:
        json_text: Text content that may contain JSON
        
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

def create_text_response(text: str) -> dict:
    """
    Creates a standardized text-only response payload.
    
    Args:
        text: The text content of the response
        
    Returns:
        Response dictionary with text content and null data fields
    """
    return {
        "dataset": [],
        "fields": [],
        "sql": "",
        "aggregationDefinition": {
            "dimensions": [],
            "measures": [],
            "preAggregationFilters": "",
            "postAggregationFilters": "",
            "timeDimension": [],
            "geoDimension": [],
            "categoricalDimension": []
        },
        "chartType": "text",
        "availableChartTypes": ["text"],
        "textResponse": text
    }

def generate_sql(definition: AggregationDefinition, table_name: str, user_location: Optional[Dict[str, float]] = None) -> str:
    """
    Generates a SQL query from an aggregation definition.
    """
    start_time = time.time()
    
    # Load data schema to check dimension data types
    with open("data/data_schema.json", "r") as f:
        data_schema = json.load(f)
    
    # Create a lookup for dimension data types
    dimension_types = {}
    for category in ["time_dimension", "geo_dimension", "categorical_dimension"]:
        for dim in data_schema["dimensions"].get(category, []):
            dimension_types[dim["physical_name"]] = dim["data_type"]

    # Build SELECT clause
    dims = definition.dimensions
    dims_clause = "\n  , ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    select_clause = f"{dims_clause}\n  , {measures_clause}" if dims_clause and measures_clause else (dims_clause or measures_clause)
    
    # Add statistical metadata for each measure
    stats_metadata = ""
    for measure in definition.measures:
        measure_alias = measure['alias']
        
        # Add basic statistics as window functions
        stats_metadata += f"""
  , avg({measure_alias}) over () as metadata_avg_{measure_alias}
  , median({measure_alias}) over () as metadata_median_{measure_alias}
  , stddev({measure_alias}) over () as metadata_stddev_{measure_alias}"""
        
        # Add top/bottom entries with their dimension values
        # For top/bottom values, include ALL dimensions, not just the primary one
        if dims:
            # Build a JSON array containing all dimensions and the measure value
            dim_array_elements = ", ".join(dims) + f", {measure_alias}"
            stats_metadata += f"""
  , cast(max_by(json_array({dim_array_elements}), {measure_alias}, 3) over () as string) as metadata_top_3_{measure_alias}
  , cast(min_by(json_array({dim_array_elements}), {measure_alias}, 3) over () as string) as metadata_bottom_3_{measure_alias}"""
        else:
            stats_metadata += ""
    
    # Add result set size indicator
    stats_metadata += """
  , cast(sum(min(1)) over () > 5000 as string) as metadata_result_exceeds_limit"""
    
    # Add date range metadata using window functions
    date_metadata = """\n  , min(min(created_date)) over () as metadata_min_created_date\n  , max(max(created_date)) over () as metadata_max_created_date"""
    
    # Add location reference if location is in the dimensions
    location_reference = ""
    if dims and any("location" in dim or "incident_zip" in dim or "neighborhood_name" in dim for dim in dims):
        location_reference = """\n  , min(borough) as reference_borough"""
        logger.info("Adding location reference to query (borough)")

        if dims and any("location" in dim for dim in dims):
            location_reference += """,\n  string_agg(distinct nullif(neighborhood_name, 'Unspecified'), ', ') as reference_neighborhood"""
            logger.info("Adding location reference to query (neighborhood_name)")
    
    # Combine all metadata
    select_clause += stats_metadata + date_metadata + location_reference
    
    # Create the SQL query with all the added metadata
    sql = f"SELECT\n  {select_clause}\nFROM {table_name}"

    # Create quality filters based on dimensions
    quality_filters = []
    for dim in dims:
        if dim in dimension_types:
            data_type = dimension_types[dim]
            if data_type == "string":
                quality_filters.append(f"{dim} != 'Unspecified'")
            else:
                quality_filters.append(f"{dim} IS NOT NULL")

    # Add pre-aggregation filters first if they exist
    where_clause_exists = False
    if definition.preAggregationFilters:
        filters = definition.preAggregationFilters
        
        if user_location and ("{{user_latitude}}" in filters or "{user_latitude}" in filters):
            logger.info(f"Location placeholders found in filters, substituting with user coordinates")
            
            for placeholder, replacement in [
                ("{{user_latitude}}", str(user_location.get('latitude'))),
                ("{{user_longitude}}", str(user_location.get('longitude'))),
                ("{user_latitude}", str(user_location.get('latitude'))),
                ("{user_longitude}", str(user_location.get('longitude')))
            ]:
                filters = filters.replace(placeholder, replacement)
            
            logger.info(f"Filters after substitution: [LOCATION DATA APPLIED]")
        
        sql += f"\nWHERE {filters}"
        where_clause_exists = True

    # Add quality filters
    if quality_filters:
        quality_condition = " AND ".join(quality_filters)
        if where_clause_exists:
            sql += f" AND ({quality_condition})"
        else:
            sql += f"\nWHERE {quality_condition}"
    
    # Add grouping if dimensions exist
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f"\nGROUP BY {group_clause}"
    
    # Add post-aggregation filters (HAVING)
    if definition.postAggregationFilters:
        sql += f"\nHAVING {definition.postAggregationFilters}"
    
    # Add ordering - prioritize topN if available
    if hasattr(definition, 'topN') and definition.topN:
        order_by_keys = ', '.join(definition.topN.orderByKey)
        sql += f"\nORDER BY {order_by_keys}"
        sql += f"\nLIMIT {definition.topN.topN};"
    else:
        # Use standard ordering rules
        if len(dims) == 1:
            if dims[0] == 'time_to_resolve_day_bin':
                sql += f"\nORDER BY time_to_resolve_day_bin ASC"
            elif dims[0] == 'created_weekday_datepart':
                sql += f"\nORDER BY MIN(created_weekday_order) ASC"
            elif dims[0] == 'closed_weekday_datepart':
                sql += f"\nORDER BY MIN(closed_weekday_order) ASC"
            elif dims[0] in TIME_DIMENSIONS:
                sql += f"\nORDER BY {dims[0]} ASC"
            elif definition.measures:
                sql += f"\nORDER BY {definition.measures[0]['alias']} DESC"
        elif definition.timeDimension:
            sql += f"\nORDER BY {definition.timeDimension[0]} ASC"
        elif definition.measures:
            sql += f"\nORDER BY {definition.measures[0]['alias']} DESC"
        
        # Add default limit
        sql += "\nLIMIT 5000;"
    
    logger.info(f"SQL generation completed in {time.time() - start_time:.2f}s")
    logger.info(f"Generated SQL:\n{sql}")
    return sql.strip()

def execute_sql_in_duckDB(sql: str, db_filename: str) -> tuple[list, dict]:
    """
    Executes a SQL query in DuckDB and returns both results and metadata.
    """
    start_time = time.time()
    logger.info(f"Executing SQL query in DuckDB")
    
    metadata = {}
    try:
        with duckdb.connect(db_filename) as con:
            # Setup spatial extensions
            con.execute("INSTALL spatial;")
            con.execute("LOAD spatial;")
            con.execute("SET default_collation='nocase';")
            
            # Execute the query directly
            df = con.execute(sql).fetchdf()
            row_count = len(df)
            logger.info(f"Query executed successfully: {row_count} rows returned")

            if row_count > 0:
                # Extract metadata from the results
                metadata_cols = [col for col in df.columns if col.startswith('metadata_')]
                
                if metadata_cols:
                    # Process date range metadata
                    if 'metadata_min_created_date' in df.columns and 'metadata_max_created_date' in df.columns:
                        metadata['createdDateRange'] = [
                            df['metadata_min_created_date'].iloc[0],
                            df['metadata_max_created_date'].iloc[0]
                        ]
                    
                    # Process statistical metadata
                    stats_metadata = {}
                    for col in metadata_cols:
                        if col.startswith('metadata_') and col not in ['metadata_min_created_date', 'metadata_max_created_date']:
                            # Extract the statistic name and measure name
                            parts = col.replace('metadata_', '').split('_', 1)
                            if len(parts) == 2:
                                stat_name, measure_name = parts
                                
                                if measure_name not in stats_metadata:
                                    stats_metadata[measure_name] = {}
                                
                                # Store the statistic value
                                stats_metadata[measure_name][stat_name] = df[col].iloc[0]
                    
                    # Add the statistics to the metadata
                    if stats_metadata:
                        metadata['statistics'] = stats_metadata
                
                # Remove all metadata columns from result set
                if metadata_cols:
                    df = df.drop(columns=metadata_cols)
            else:
                logger.info("Query returned no results")
                
    except Exception as e:
        logger.error(f"Database query failed: {str(e)}")
        logger.error(f"SQL with error:\n{sql}")
        raise
    
    # Format datetime columns for JSON serialization
    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
        
    # Format datetime values in metadata array
    if 'createdDateRange' in metadata:
        metadata['createdDateRange'] = [
            value.strftime('%Y-%m-%d') if isinstance(value, pd.Timestamp) else value
            for value in metadata['createdDateRange']
        ]
    
    logger.info(f"SQL execution completed in {time.time() - start_time:.2f}s")
    results = json.loads(df.to_json(orient="records"))
    return results, metadata

def calculate_dimension_cardinality_stats(dataset: List[Dict], dimensions: List[str]) -> Dict[str, Dict[str, float]]:
    """
    Calculates cardinality statistics for each dimension in the dataset.
    """
    if not dataset or not dimensions:
        return {}
    
    # Convert to Polars DataFrame for better performance
    try:
        df = pl.DataFrame(dataset)
    except Exception as e:
        logger.warning(f"Failed to use Polars: {str(e)}. Using pandas.")
        df = pd.DataFrame(dataset)
    
    stats = {}
    
    # Calculate stats for each dimension
    for dim in dimensions:
        if dim not in df.columns:
            continue
            
        total_unique = df[dim].n_unique()
        
        # Handle single dimension case
        if len(dimensions) == 1:
            stats[dim] = {
                "total_unique": total_unique,
                "min_per_group": total_unique,
                "max_per_group": total_unique,
                "avg_per_group": float(total_unique),
                "median_per_group": float(total_unique),
                "std_per_group": 0.0
            }
            continue
        
        # For multiple dimensions, calculate per-group stats
        other_dims = [d for d in dimensions if d != dim]
        
        if isinstance(df, pl.DataFrame):
            grouped = (df
                      .group_by(other_dims)
                      .agg(pl.col(dim).n_unique().alias("unique_count")))
            
            unique_counts = grouped["unique_count"].to_numpy()
        else:
            grouped = df.groupby(other_dims)[dim].nunique().reset_index()
            unique_counts = grouped[dim].values
        
        # Calculate comprehensive statistics
        stats[dim] = {
            "total_unique": int(total_unique),
            "min_per_group": int(np.min(unique_counts)),
            "max_per_group": int(np.max(unique_counts)),
            "avg_per_group": float(np.mean(unique_counts)),
            "median_per_group": float(np.median(unique_counts)),
            "std_per_group": float(np.std(unique_counts)),
            "group_count": len(unique_counts)
        }
    
    return stats

def reorder_dimensions_by_cardinality(agg_def: AggregationDefinition, dimension_stats: Dict[str, Dict[str, float]]) -> AggregationDefinition:
    """
    Reorders dimensions by their cardinality (highest to lowest).
    """
    if not agg_def.dimensions or len(agg_def.dimensions) <= 1 or not dimension_stats:
        return agg_def
    
    # Sort dimensions by total_unique (descending)
    sorted_dims = sorted(
        agg_def.dimensions,
        key=lambda dim: dimension_stats.get(dim, {}).get("total_unique", 0),
        reverse=True
    )
    
    # Re-classify dimensions after sorting
    time_dim, geo_dim, cat_dim = classify_dimensions(sorted_dims)
    
    return agg_def.copy(update={
        "dimensions": sorted_dims,
        "timeDimension": time_dim,
        "geoDimension": geo_dim,
        "categoricalDimension": cat_dim
    })