import json
import duckdb
import os

# Set Variables
PUBLIC_BUCKET_URL = "https://pub-cb6e94f4490c42b9b0c520e8116fb9b7.r2.dev/"
OBJECTS = ['requests_311']

# Configuration
db_filename = 'nyc_open_data.db'

# Remove the database file if it exists
if os.path.exists(db_filename):
    os.remove(db_filename)

# Connect to the DuckDB database file
con = duckdb.connect(db_filename)

# Create Views
for object_name in OBJECTS:
    object_url = PUBLIC_BUCKET_URL + object_name + '.parquet'
    create_view_query = f"CREATE VIEW {object_name} AS SELECT * FROM read_parquet('{object_url}');"
    con.execute(create_view_query)
    print(f'View {object_name} is successfully created.')

con.close()