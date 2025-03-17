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
    sql_file = f'./sql/{object_name}.sql'
    with open(sql_file, 'r') as file:
        _create_view_query = file.read()
        create_view_query = _create_view_query.format(object_name=object_name, object_url=object_url)
    con.execute(create_view_query)
    print(f'View {object_name} is successfully created.')

con.close()