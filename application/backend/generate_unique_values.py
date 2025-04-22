#!/usr/bin/env python3
import json
import duckdb
import os
import sys
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure target columns to extract unique values
TARGET_COLUMNS = [
    'borough',
    'county',
    'complaint_type_middle',
    'complaint_type_large',
    'status',
    'agency_name',
    'agency_category',
    'neighborhood_name',
    'community_board',
    'location_type',
    'address_type',
    'open_data_channel_type',
]

def generate_unique_values(output_dir='../backend/gemini_instructions/references/'):
    """
    Generate JSON files with unique values for specified columns using in-memory DuckDB.
    """
    start_time = time.time()
    logger.info("Starting unique values generation...")
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Create in-memory DuckDB connection
        con = duckdb.connect(":memory:")
        
        # Setup spatial extensions (same as query_engine.py)
        logger.info("Setting up DuckDB with spatial extensions...")
        con.execute("INSTALL spatial;")
        con.execute("LOAD spatial;")
        con.execute("set default_collation='nocase';")
        
        # Create view from SQL file (same approach as query_engine.py)
        logger.info("Creating requests_311 view from SQL file...")
        with open("../backend/sqls/requests_311.sql", "r") as f:
            view_sql = f.read()
        
        view_sql = view_sql.format(object_name="requests_311")
        con.execute(view_sql)
        
        # Build aggregate expressions for all columns
        logger.info(f"Generating unique values for {len(TARGET_COLUMNS)} columns...")
        agg_expressions = []
        for column in TARGET_COLUMNS:
            agg_expressions.append(
                f"array_agg(DISTINCT CASE WHEN {column} != 'Unspecified' AND {column} IS NOT NULL THEN {column} END) AS {column}_values"
            )
        
        # Execute query to get unique values
        query = f"SELECT {', '.join(agg_expressions)} FROM requests_311;"
        logger.info(f"Executing query: {query[:100]}...")
        result = con.execute(query).fetchone()
        
        # Process results into the combined dictionary
        combined = {}
        for i, column in enumerate(TARGET_COLUMNS):
            values = result[i]  # Get array from the result row
            clean_values = sorted([v for v in values if v is not None])
            combined[column] = clean_values
            logger.info(f"Found {len(clean_values)} unique values for {column}")
        
        # Write combined JSON file
        combined_file = os.path.join(output_dir, "all_filters.json")
        with open(combined_file, 'w') as f:
            json.dump(combined, f, indent=2)
        
        logger.info(f"Created combined filter file: {combined_file}")
        logger.info(f"Total execution time: {time.time() - start_time:.2f} seconds")
        
    except Exception as e:
        logger.error(f"Error generating unique values: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Close connection
        try:
            con.close()
        except:
            pass

if __name__ == "__main__":
    generate_unique_values()
    print("✅ Unique value extraction complete!")