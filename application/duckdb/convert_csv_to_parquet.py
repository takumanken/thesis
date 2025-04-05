import duckdb

# 311 dataset
duckdb.sql("""
    COPY (
        SELECT * FROM 'data/requests_311/csv/*.csv'
    ) TO 'data/requests_311/parquet/requests_311.parquet' (FORMAT 'parquet');
""")
