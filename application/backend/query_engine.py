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

    # Build SELECT clause
    dims = definition.dimensions
    dims_clause = "\n  , ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    select_clause = f"{dims_clause}\n  , {measures_clause}" if dims_clause and measures_clause else (dims_clause or measures_clause)
    
    # Add date range metadata using window functions
    date_metadata = """\n  , min(min(created_date)) over () as metadata_min_created_date\n  , max(max(created_date)) over () as metadata_max_created_date"""
    
    # Add location reference if location is in the dimensions
    location_reference = ""
    if dims and any("location" in dim.lower() for dim in dims):
        location_reference = """\n  , min(borough) as reference_borough\n  , min(neighborhood_name)as reference_neighborhood
        """
        logger.info("Adding location reference to query (borough and neighborhood)")
    
    # Combine all metadata
    select_clause += date_metadata + location_reference
    
    sql = f"SELECT\n  {select_clause}\nFROM {table_name}"
    
    # Add filters with location placeholders if needed
    if definition.preAggregationFilters:
        filters = definition.preAggregationFilters
        
        if user_location and ("{{user_latitude}}" in filters or "{user_latitude}" in filters):
            logger.info(f"Location placeholders found in filters, substituting with: lat={user_location.get('latitude'):.6f}, lng={user_location.get('longitude'):.6f}")
            logger.info(f"Original filters: {filters}")
            
            for placeholder, replacement in [
                ("{{user_latitude}}", str(user_location.get('latitude'))),
                ("{{user_longitude}}", str(user_location.get('longitude'))),
                ("{user_latitude}", str(user_location.get('latitude'))),
                ("{user_longitude}", str(user_location.get('longitude')))
            ]:
                filters = filters.replace(placeholder, replacement)
            
            logger.info(f"Filters after substitution: {filters}")
        
        sql += f"\n  WHERE {filters}"
    
    # Add grouping if dimensions exist
    if dims:
        group_clause = ", ".join(str(i) for i in range(1, len(dims) + 1))
        sql += f"\nGROUP BY {group_clause}"
    
    # Add post-aggregation filters (HAVING)
    if definition.postAggregationFilters:
        sql += f"\nHAVING {definition.postAggregationFilters}"
    
    # Add ordering
    if len(dims) == 1 and dims[0] in ['created_weekday_datepart', 'closed_weekday_datepart']:
        if dims[0] == 'created_weekday_datepart':
            sql += f"\nORDER BY MIN(created_weekday_order) ASC"
        elif dims[0] == 'closed_weekday_datepart':
            sql += f"\nORDER BY MIN(closed_weekday_order) ASC"
    elif definition.timeDimension:
        sql += f"\nORDER BY {definition.timeDimension[0]} ASC"
    elif definition.measures:
        sql += f"\nORDER BY {definition.measures[0]['alias']} DESC"
    
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
        with duckdb.connect("data/nyc_open_data_explorer.duckdb") as con:
            # Setup spatial extensions
            con.execute("INSTALL spatial;")
            con.execute("LOAD spatial;")
            con.execute("SET default_collation='nocase';")
            
            # Execute the query directly
            df = con.execute(sql).fetchdf()
            row_count = len(df)
            logger.info(f"Query executed successfully: {row_count} rows returned")
            
            # Extract metadata from the first row
            metadata['createdDateRange'] = [
                df['metadata_min_created_date'].iloc[0],
                df['metadata_max_created_date'].iloc[0]
            ]
                
            # Remove all metadata columns from result set
            metadata_cols = [col for col in df.columns if col.startswith('metadata_')]
            if metadata_cols:
                df = df.drop(columns=metadata_cols)

    
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