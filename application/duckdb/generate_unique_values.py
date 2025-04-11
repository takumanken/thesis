import json
import duckdb
import os
import sys

# Configure target columns to extract unique values
TARGET_COLUMNS = [
    'borough',
    'complaint_type_middle',
    'status',
    'agency_name',
    'neighborhood_name'
]

def generate_unique_values(db_path='../backend/nyc_open_data.db', output_dir='../backend/filter_values'):
    """
    Generate JSON files with unique values for specified columns.
    """
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Connect to the DuckDB database
    print(f"Connecting to database: {db_path}")
    con = duckdb.connect(db_path)
    
    # Build SQL query for all target columns
    sql_parts = []
    for column in TARGET_COLUMNS:
        sql_parts.append(
            f"SELECT '{column}' as field_name, array_agg(DISTINCT {column}) as value_list FROM requests_311 WHERE {column} != 'Unspecified'"
        )
    
    sql_query = " UNION ALL ".join(sql_parts)
    print("Executing SQL query...")
    
    # Execute the query
    try:
        results = con.execute(sql_query).fetchall()
        
        # Create a combined file with all values
        combined = {}
        for field_name, value_list in results:
            clean_values = sorted([v for v in value_list if v is not None])
            combined[field_name] = clean_values
        
        combined_file = os.path.join(output_dir, "all_filters.json")
        with open(combined_file, 'w') as f:
            json.dump(combined, f, indent=4)
        
        print(f"Created combined filter file: {combined_file}")
        
    except Exception as e:
        print(f"Error executing query: {e}")
        sys.exit(1)
    finally:
        con.close()

if __name__ == "__main__":
    generate_unique_values()
    print("Unique value extraction complete!")