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
        with open("sqls/requests_311.sql", "r") as f:
            view_sql = f.read()
        
        # Format the SQL with the view name
        view_sql = view_sql.format(object_name="requests_311")
        
        # Execute the SQL to create the view
        con.execute(view_sql)
        
        logger.info(f"DuckDB file created in {time.time() - start_time:.2f}s")
        
    except Exception as e:
        logger.error(f"Error creating DuckDB file: {str(e)}")
        raise
    finally:
        con.close()

if __name__ == "__main__":
    create_duckdb_file()
    print("✅ DuckDB file creation complete!")