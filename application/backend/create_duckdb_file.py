import duckdb
import os
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_duckdb_file(output_path='data/nyc_open_data_explorer.duckdb'):

    start_time = time.time()
    logger.info(f"Creating DuckDB file at: {output_path}")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Connect to the database file
    con = duckdb.connect(output_path)
    
    try:
        # Read the SQL file
        with open("sqls/nta_population.sql", "r") as f:
            nta_population_sql = f.read()
        with open("sqls/requests_311.sql", "r") as f:
            requests_311_sql = f.read()
        
        
        # Execute the SQL
        con.execute(nta_population_sql)
        con.execute(requests_311_sql)
        
        logger.info(f"DuckDB file created in {time.time() - start_time:.2f}s")
        
    except Exception as e:
        logger.error(f"Error creating DuckDB file: {str(e)}")
        raise
    finally:
        con.close()

if __name__ == "__main__":
    create_duckdb_file()
    print("✅ DuckDB file creation complete!")