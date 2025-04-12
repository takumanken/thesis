import json
import duckdb
import os
import sys

# Configure target columns to extract unique values
TARGET_COLUMNS = [
    'borough',
    'county',
    'complaint_type_middle',
    'status',
    'agency_name',
    'neighborhood_name',
    'community_board',
    'location_type',
    'address_type',
    'open_data_channel_type',
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
    
    # Build aggregate expressions for all columns
    agg_expressions = []
    for column in TARGET_COLUMNS:
        agg_expressions.append(
            f"array_agg(DISTINCT CASE WHEN {column} != 'Unspecified' AND {column} IS NOT NULL THEN {column} END) AS {column}_values"
        )
    
    # Build temp table query with all target columns
    column_list = ", ".join(TARGET_COLUMNS)
    
    # Combine both queries into a single execution
    combined_query = f"""
    CREATE TEMP TABLE base AS SELECT {column_list} FROM requests_311;
    SELECT {', '.join(agg_expressions)} FROM base;
    """
    
    print("Executing combined query...")
    
    try:
        # Execute both statements in a single call
        result = con.execute(combined_query).fetchone()
        
        # Process results into the combined dictionary
        combined = {}
        for i, column in enumerate(TARGET_COLUMNS):
            values = result[i]  # Get array from the result row
            clean_values = sorted([v for v in values if v is not None])
            combined[column] = clean_values
        
        combined_file = os.path.join(output_dir, "all_filters.json")
        with open(combined_file, 'w') as f:
            json.dump(combined, f, indent=4)
        
        print(f"Created combined filter file: {combined_file}")
        
    except Exception as e:
        print(f"Error executing query: {e}")
        sys.exit(1)
    finally:
        # Clean up temp table before closing
        try:
            con.execute("DROP TABLE IF EXISTS base")
        except:
            pass
        con.close()

if __name__ == "__main__":
    generate_unique_values()
    print("Unique value extraction complete!")