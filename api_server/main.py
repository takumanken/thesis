from fastapi import FastAPI
import duckdb

app = FastAPI()

@app.get("/")
def read_root():
    # Example DuckDB in-memory table
    con = duckdb.connect(database=':memory:')
    con.execute("CREATE TABLE fruits (id INTEGER, name VARCHAR)")
    con.execute("INSERT INTO fruits VALUES (1, 'apple'), (2, 'banana')")
    result = con.execute("SELECT * FROM fruits").fetchall()
    con.close()
    return {"items": result}