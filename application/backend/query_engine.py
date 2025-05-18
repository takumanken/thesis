import json
import time
import logging
import duckdb
import pandas as pd
import polars as pl
import numpy as np
from typing import Dict, List, Tuple, Optional, Any, Union

from google.genai import types
from models import AggregationDefinition
from visualization_recommender import TIME_DIMENSIONS, GEO_DIMENSIONS, classify_dimensions

logger = logging.getLogger(__name__)

# =========================================================
# RESPONSE HANDLING
# =========================================================

def extract_json_from_text(json_text: str) -> Tuple[Dict, bool]:
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

# =========================================================
# SQL GENERATION
# =========================================================

def _get_dimension_types() -> Dict[str, str]:
    """
    Gets dimension types from data schema.
    
    Returns:
        Dictionary mapping dimension names to their data types
    """
    with open("data/data_schema.json", "r") as f:
        data_schema = json.load(f)
    
    dimension_types = {}
    for category in ["time_dimension", "geo_dimension", "categorical_dimension"]:
        for dim in data_schema["dimensions"].get(category, []):
            dimension_types[dim["physical_name"]] = dim["data_type"]
            
    return dimension_types

def _build_select_clause(definition: AggregationDefinition) -> str:
    """
    Builds the SELECT clause for a SQL query.
    
    Args:
        definition: The aggregation definition
        
    Returns:
        The SELECT clause as a string
    """
    dims = definition.dimensions
    dims_clause = "\n  , ".join(dims) if dims else ""
    measures_clause = ", ".join([f"{m['expression']} AS {m['alias']}" for m in definition.measures])
    
    return f"{dims_clause}\n  , {measures_clause}" if dims_clause and measures_clause else (dims_clause or measures_clause)

def _build_metadata_clauses(definition: AggregationDefinition) -> str:
    """
    Builds SQL clauses for metadata collection.
    
    Args:
        definition: The aggregation definition
        
    Returns:
        SQL clauses for metadata as a string
    """
    dims = definition.dimensions
    stats_metadata = ""
    
    # Add statistics for each measure
    for measure in definition.measures:
        measure_alias = measure['alias']
        
        # Add basic statistics as window functions
        stats_metadata += f"""
  , avg({measure_alias}) over () as metadata_avg_{measure_alias}
  , median({measure_alias}) over () as metadata_median_{measure_alias}
  , stddev({measure_alias}) over () as metadata_stddev_{measure_alias}"""
        
        # Add top/bottom entries with dimension values
        if dims:
            dim_array_elements = ", ".join(dims) + f", {measure_alias}"
            stats_metadata += f"""
  , cast(max_by(json_array({dim_array_elements}), {measure_alias}, 3) over () as string) as metadata_top_3_{measure_alias}
  , cast(min_by(json_array({dim_array_elements}), {measure_alias}, 3) over () as string) as metadata_bottom_3_{measure_alias}"""
    
    # Add result set size indicator
    stats_metadata += """
  , cast(sum(min(1)) over () > 5000 as string) as metadata_result_exceeds_limit"""
    
    # Add date range metadata
    date_metadata = """\n  , min(min(created_date)) over () as metadata_min_created_date\n  , max(max(created_date)) over () as metadata_max_created_date"""
    
    # Add location reference if needed
    location_reference = ""
    if dims and any("location" in dim or "incident_zip" in dim or "neighborhood_name" in dim for dim in dims):
        location_reference = """\n  , min(borough) as reference_borough"""
        
        if dims and any("location" in dim for dim in dims):
            location_reference += """,\n  string_agg(distinct nullif(neighborhood_name, 'Unspecified'), ', ') as reference_neighborhood"""
    
    return stats_metadata + date_metadata + location_reference

def _build_order_clause(definition: AggregationDefinition) -> str:
    """
    Builds the ORDER BY clause for a SQL query.
    
    Args:
        definition: The aggregation definition
        
    Returns:
        The ORDER BY clause as a string
    """
    dims = definition.dimensions
    
    # Use topN if available
    if hasattr(definition, 'topN') and definition.topN:
        order_by_keys = ', '.join(definition.topN.orderByKey)
        return f"ORDER BY {order_by_keys}\nLIMIT {definition.topN.topN}"
    
    # Use standard ordering rules
    if len(dims) == 1:
        if dims[0] == 'time_to_resolve_day_bin':
            return "ORDER BY time_to_resolve_day_bin ASC"
        elif dims[0] == 'created_weekday_datepart':
            return "ORDER BY MIN(created_weekday_order) ASC"
        elif dims[0] == 'closed_weekday_datepart':
            return "ORDER BY MIN(closed_weekday_order) ASC"
        elif dims[0] in TIME_DIMENSIONS:
            return f"ORDER BY {dims[0]} ASC"
        elif definition.measures:
            return f"ORDER BY {definition.measures[0]['alias']} DESC"
    elif definition.timeDimension:
        return f"ORDER BY {definition.timeDimension[0]} ASC"
    elif definition.measures:
        return f"ORDER BY {definition.measures[0]['alias']} DESC"
    
    return ""  # Default is no explicit ordering

def generate_sql(definition: AggregationDefinition, table_name: str) -> str:
    """
    Generates a SQL query from aggregation definition, keeping location placeholders intact.
    
    Args:
        definition: The aggregation definition
        table_name: The database table name
        
    Returns:
        SQL query string with placeholders for location data
    """
    start_time = time.time()
    logger.info("Generating SQL from aggregation definition")
    
    # Get dimension types for quality filters
    dimension_types = _get_dimension_types()
    
    # Build SELECT clause
    select_clause = _build_select_clause(definition)
    
    # Add metadata clauses
    metadata_clauses = _build_metadata_clauses(definition)
    
    # Combine select and metadata
    full_select = f"{select_clause}{metadata_clauses}"
    
    # Create the SQL query
    sql = f"SELECT\n  {full_select}\nFROM {table_name}"
    
    # Create quality filters based on dimensions
    dims = definition.dimensions
    quality_filters = []
    for dim in dims:
        if dim in dimension_types:
            data_type = dimension_types[dim]
            if data_type == "string":
                quality_filters.append(f"{dim} != 'Unspecified'")
            else:
                quality_filters.append(f"{dim} IS NOT NULL")
    
    # Add pre-aggregation filters if they exist
    where_clause_exists = False
    if definition.preAggregationFilters:
        filters = definition.preAggregationFilters
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
    
    # Add ordering
    order_clause = _build_order_clause(definition)
    if order_clause:
        sql += f"\n{order_clause}"
    
    # Add default limit if no ordering specified
    if "LIMIT" not in sql:
        sql += "\nLIMIT 5000"
    
    # Add semicolon
    if not sql.strip().endswith(";"):
        sql += ";"
    
    logger.info(f"SQL generation completed in {time.time() - start_time:.2f}s")
    logger.info("Generated SQL with placeholders (sensitive data masked)")
    
    return sql.strip()

# =========================================================
# SQL EXECUTION
# =========================================================

def execute_sql_in_duckDB(sql: str, db_filename: str, user_location: Optional[Dict[str, float]] = None) -> Tuple[List, Dict]:
    """
    Executes a SQL query in DuckDB, replacing location placeholders right before execution.
    
    Args:
        sql: SQL query with potential location placeholders
        db_filename: Path to DuckDB database file
        user_location: Optional user location data (lat/long)
        
    Returns:
        Tuple of (results, metadata)
    """
    start_time = time.time()
    logger.info("Executing SQL query in DuckDB")
    
    # Replace location placeholders only at execution time
    execution_sql = sql
    location_used = False
    
    if user_location and ("{{user_latitude}}" in sql or "{user_latitude}" in sql):
        logger.info("Replacing location placeholders for execution only")
        location_used = True
        
        # Limit precision to 3 decimal places for privacy
        lat = user_location.get('latitude')
        lng = user_location.get('longitude')
        
        for placeholder, value in [
            ("{{user_latitude}}", str(lat)),
            ("{{user_longitude}}", str(lng)),
            ("{user_latitude}", str(lat)),
            ("{user_longitude}", str(lng))
        ]:
            execution_sql = execution_sql.replace(placeholder, value)
    
    metadata = {}
    try:
        with duckdb.connect(db_filename) as con:
            # Setup spatial extensions
            con.execute("INSTALL spatial;")
            con.execute("LOAD spatial;")
            con.execute("SET default_collation='nocase';")
            
            # Execute the query with substituted values
            df = con.execute(execution_sql).fetchdf()
            row_count = len(df)
            
            if location_used:
                logger.info(f"Location-based query executed successfully: {row_count} rows")
            else:
                logger.info(f"Query executed successfully: {row_count} rows")

            if row_count > 0:
                metadata = _extract_metadata_from_results(df)
                
                # Remove all metadata columns
                metadata_cols = [col for col in df.columns if col.startswith('metadata_')]
                if metadata_cols:
                    df = df.drop(columns=metadata_cols)
            else:
                logger.info("Query returned no results")
                
    except Exception as e:
        logger.error(f"Database query failed: {str(e)}")
        
        # Log sanitized SQL (without location data)
        sanitized_sql = execution_sql
        if location_used and user_location:
            # Replace actual coordinates with placeholders in error logs
            for coord in [str(user_location.get('latitude')), str(user_location.get('longitude'))]:
                sanitized_sql = sanitized_sql.replace(coord, "[MASKED_COORDINATE]")
                
        logger.error(f"SQL query with error:\n{sanitized_sql}")
        raise
    
    # Format datetime columns for JSON serialization
    for col in df.select_dtypes(include=['datetime64[ns]']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%d')
    
    # Format datetime values in metadata
    if 'createdDateRange' in metadata:
        metadata['createdDateRange'] = [
            value.strftime('%Y-%m-%d') if isinstance(value, pd.Timestamp) else value
            for value in metadata['createdDateRange']
        ]
    
    logger.info(f"SQL execution completed in {time.time() - start_time:.2f}s")
    results = json.loads(df.to_json(orient="records"))
    return results, metadata

def _extract_metadata_from_results(df: pd.DataFrame) -> Dict:
    """
    Extracts metadata from query results.
    
    Args:
        df: DataFrame containing query results
        
    Returns:
        Dictionary of metadata
    """
    metadata = {}
    metadata_cols = [col for col in df.columns if col.startswith('metadata_')]
    
    if not metadata_cols:
        return metadata
    
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
        
    return metadata

# =========================================================
# DIMENSION ANALYSIS
# =========================================================

def calculate_dimension_cardinality_stats(dataset: List[Dict], dimensions: List[str]) -> Dict[str, Dict[str, float]]:
    """
    Calculates cardinality statistics for each dimension in the dataset.
    
    Args:
        dataset: List of data records
        dimensions: List of dimension names
        
    Returns:
        Dictionary mapping dimensions to their cardinality statistics
    """
    if not dataset or not dimensions:
        return {}
    
    # Try using Polars first, fall back to pandas if needed
    df = _convert_to_dataframe(dataset)
    
    stats = {}
    for dim in dimensions:
        if dim not in df.columns:
            continue
            
        # Calculate dimension stats
        stats[dim] = _calculate_single_dimension_stats(df, dim, dimensions)
    
    return stats

def _convert_to_dataframe(dataset: List[Dict]) -> Union[pl.DataFrame, pd.DataFrame]:
    """
    Converts dataset to a DataFrame, using Polars if possible.
    
    Args:
        dataset: List of data records
        
    Returns:
        Polars or pandas DataFrame
    """
    try:
        return pl.DataFrame(dataset)
    except Exception as e:
        logger.warning(f"Failed to use Polars: {str(e)}. Using pandas.")
        return pd.DataFrame(dataset)

def _calculate_single_dimension_stats(
    df: Union[pl.DataFrame, pd.DataFrame], 
    dim: str, 
    dimensions: List[str]
) -> Dict[str, float]:
    """
    Calculates statistics for a single dimension.
    
    Args:
        df: DataFrame containing data
        dim: Dimension name
        dimensions: List of all dimensions
        
    Returns:
        Dictionary of dimension statistics
    """
    # Handle single dimension case
    if isinstance(df, pl.DataFrame):
        total_unique = df[dim].n_unique()
    else:
        total_unique = df[dim].nunique()
        
    if len(dimensions) == 1:
        return {
            "total_unique": total_unique,
            "min_per_group": total_unique,
            "max_per_group": total_unique,
            "avg_per_group": float(total_unique),
            "median_per_group": float(total_unique),
            "std_per_group": 0.0
        }
        
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
    return {
        "total_unique": int(total_unique),
        "min_per_group": int(np.min(unique_counts)),
        "max_per_group": int(np.max(unique_counts)),
        "avg_per_group": float(np.mean(unique_counts)),
        "median_per_group": float(np.median(unique_counts)),
        "std_per_group": float(np.std(unique_counts)),
        "group_count": len(unique_counts)
    }

def reorder_dimensions_by_cardinality(agg_def: AggregationDefinition, dimension_stats: Dict[str, Dict[str, float]]) -> AggregationDefinition:
    """
    Reorders dimensions by their cardinality (highest to lowest).
    
    Args:
        agg_def: Aggregation definition
        dimension_stats: Dictionary of dimension statistics
        
    Returns:
        Updated aggregation definition with reordered dimensions
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

# =========================================================
# QUERY PROCESSING
# =========================================================

async def process_aggregation_query(
    response_text: str,
    user_location: Optional[Dict[str, Any]],
    request_id: str,
    system_instruction: str,
    db_filename: str,
    generate_content_safe
) -> Dict[str, Any]:
    """
    Process translated query text into a data query and execute it
    
    Args:
        response_text: Translated query from NL processor
        user_location: Optional user location data
        request_id: Unique identifier for the request
        system_instruction: System instruction for Gemini API
        db_filename: Path to DuckDB database file
        generate_content_safe: Safe wrapper for Gemini API calls
        
    Returns:
        Dictionary with query results and metadata
    """
    # Call Gemini API for data aggregation definition
    response = generate_content_safe(
        request_id,
        model="gemini-2.5-flash-preview-04-17",
        config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0),
        contents=[response_text]
    )
    
    # Parse the AI response
    json_text = response.candidates[0].content.parts[0].text
    parsed_json, is_valid_json = extract_json_from_text(json_text)
    
    # If not valid JSON or contains text response, return as text
    if not is_valid_json or "textResponse" in parsed_json:
        text = parsed_json.get("textResponse", json_text)
        return {"textResponse": text, "chartType": "text", "availableChartTypes": ["text"]}
    
    # Process data response - classify dimensions
    agg_def = AggregationDefinition(**parsed_json)
    time_dim, geo_dim, cat_dim = classify_dimensions(agg_def.dimensions)
    agg_def = agg_def.copy(update={
        "timeDimension": time_dim,
        "geoDimension": geo_dim,
        "categoricalDimension": cat_dim
    })
    
    # Generate SQL with placeholders intact
    sql = generate_sql(agg_def, "requests_311")
    
    # Check if location is required but not provided
    location_enabled = bool(user_location)
    if ('user_latitude' in sql or 'user_longitude' in sql) and not location_enabled:
        logger.info(f"[{request_id}] Query requires location services but they are disabled")
        return {"locationRequired": True}
    
    # Execute SQL with location data
    dataset, query_metadata = execute_sql_in_duckDB(sql, db_filename, user_location)
    
    # Return basic query results
    return {
        "sql": sql,
        "dataset": dataset,
        "aggregationDefinition": agg_def,
        "queryMetadata": query_metadata
    }