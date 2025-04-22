import duckdb
import glob
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

# Load the GeoJSON file
nta = gpd.read_file("../frontend/assets/geojson/2020_nyc_neighborhood_tabulation_areas_nta.geojson")
nta = nta.to_crs("EPSG:4326")

# Save the GeoJSON as a Parquet file
nta.to_parquet("data/geo/2020_nyc_neighborhood_tabulation_areas_nta.parquet")

# Load the spatial extension
duckdb.sql("INSTALL spatial; LOAD spatial;")

duckdb.sql("""
    COPY (
        SELECT 
            c.*,
            n.nta2020 AS neighborhood_code,
            n.ntaname AS neighborhood_name,
            n.shape_area AS neighborhood_area,
            n.ntatype AS neighborhood_type,
            p.population_2010 AS population_2010
        FROM read_csv_auto('data/csv/311_*.csv') AS c
        LEFT JOIN read_parquet('data/geo/2020_nyc_neighborhood_tabulation_areas_nta.parquet') AS n
          ON st_contains(
              n.geometry,
              st_point(c.Longitude::DOUBLE, c.Latitude::DOUBLE)
          )
        LEFT JOIN
           (
                SELECT
                    "NTA Code" as nta_code,
                    MIN(CASE WHEN "Year" = 2010 THEN "Population" END) AS population_2010
                FROM read_csv_auto('data/csv/NTA_population.csv') AS p
                GROUP BY nta_code
           ) AS p
        ON n.nta2020 = p.nta_code
    ) TO 'data/parquet/requests_311.parquet' (FORMAT 'parquet');
""")