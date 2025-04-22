CREATE OR REPLACE VIEW nta_population AS

SELECT
  "NTA Code" AS neighborhood_code,
  MIN(CASE WHEN "Year" = 2000 THEN "Population" END) AS population_2000,
  MIN(CASE WHEN "Year" = 2010 THEN "Population" END) AS population_2010,
FROM read_csv('data/NTA_population.csv')
GROUP BY ALL;