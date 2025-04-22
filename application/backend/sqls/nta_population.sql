CREATE OR REPLACE VIEW nta_population AS

SELECT
  "NTA Name" as nta_name,
  "Pop 20" as population_2020,
  "Nta2020" as neighborhood_code,
  "Boro Code" as boro_code,
  UPPER("Boro Name") as borough,
  "NTA Abbrev" as nta_abbrev,
  "NTA Type" as nta_type,
  "Cdta2020" as cdta_2020,
  "CDTA Name" as cdta_name
FROM read_csv('data/nta_population.csv');