CREATE OR REPLACE VIEW nta_population AS

SELECT
  nta2020 as neighborhood_code,
  name,
  borough,
  population_2020
FROM read_csv('data/nta_population.csv');