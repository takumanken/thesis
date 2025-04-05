import pandas as pd
import pyarrow.parquet as pq
import json

# Load the Parquet file as a DataFrame
df = pd.read_parquet("data/requests_311/parquet/requests_311.parquet")

# Print data types for each column
print("\nData Types:")
print(df.dtypes)

# Print the first 5 rows
first_rows = df.head(5).to_dict(orient="records")
print(json.dumps(first_rows, indent=4, default=str))