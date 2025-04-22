import duckdb
import glob
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[logging.StreamHandler()]) # Output logs to console

logging.info("Starting CSV to Parquet conversion script.")

try:
    # Load the GeoJSON file
    geojson_path = "2020_nyc_neighborhood_tabulation_areas_nta_raw.geojson"
    parquet_geo_path = "data/geo/2020_nyc_neighborhood_tabulation_areas_nta.parquet"
    csv_pattern = 'data/csv/311_*.csv'
    output_parquet_path = 'data/parquet/requests_311.parquet'

    logging.info(f"Loading GeoJSON file: {geojson_path}")
    start_time = time.time()
    nta = gpd.read_file(geojson_path)
    logging.info(f"GeoJSON loaded successfully. Shape: {nta.shape}. Time taken: {time.time() - start_time:.2f} seconds.")

    logging.info("Converting GeoDataFrame CRS to EPSG:4326.")
    nta = nta.to_crs("EPSG:4326")
    logging.info("CRS conversion complete.")

    # Save the GeoJSON as a Parquet file
    logging.info(f"Saving GeoDataFrame to Parquet file: {parquet_geo_path}")
    start_time = time.time()
    nta.to_parquet(parquet_geo_path)
    logging.info(f"GeoDataFrame saved to Parquet. Time taken: {time.time() - start_time:.2f} seconds.")

    # Load the spatial extension
    logging.info("Initializing DuckDB and loading spatial extension.")
    start_time = time.time()
    duckdb.sql("INSTALL spatial; LOAD spatial;")
    logging.info(f"DuckDB spatial extension loaded. Time taken: {time.time() - start_time:.2f} seconds.")

    # Construct and execute the main SQL query
    sql_query = f"""
        COPY (
            SELECT 
                c.*,
                n.nta2020 AS neighborhood_code,
                n.ntaname AS neighborhood_name,
                n.shape_area AS neighborhood_area,
                n.ntatype AS neighborhood_type
            FROM read_csv_auto('{csv_pattern}') AS c
            LEFT JOIN read_parquet('{parquet_geo_path}') AS n
              ON st_contains(
                  n.geometry,
                  st_point(c.Longitude::DOUBLE, c.Latitude::DOUBLE)
              )
        ) TO '{output_parquet_path}' (FORMAT 'parquet');
    """
    logging.info(f"Executing DuckDB SQL query to join CSVs with GeoParquet and save to {output_parquet_path}.")
    logging.debug(f"SQL Query:\n{sql_query}") # Log the full query at debug level if needed
    start_time = time.time()
    duckdb.sql(sql_query)
    logging.info(f"DuckDB query executed successfully. Output saved to {output_parquet_path}. Time taken: {time.time() - start_time:.2f} seconds.")

except Exception as e:
    logging.error(f"An error occurred during the conversion process: {e}", exc_info=True)

finally:
    logging.info("Script finished.")