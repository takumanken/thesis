import json
import duckdb

# Load secrets from JSON
with open('../../secrets.json') as f:
    secrets = json.load(f)

# Set Variables
PUBLIC_BUCKET_URL = secrets['R2_PUBLIC_BUCKET_URL']
OBJECT_NAME = 'requests_311.parquet'
OBJECT_URL = PUBLIC_BUCKET_URL + OBJECT_NAME
print(OBJECT_URL)

# Connect to table
con = duckdb.connect(database=':memory:')
print(con.execute(f"SELECT * FROM read_parquet('{OBJECT_URL}') LIMIT 5").fetchall())

# Close connection (database saved automatically)
con.close()