CREATE OR REPLACE VIEW {object_name} AS
SELECT
    "Unique Key" AS unique_key,
    "Status" AS status,
    "Created Date" AS created_date,
    "Closed Date" AS closed_date,
    "Agency" AS agency,
    "Agency Name" AS agency_name,
    "Complaint Type" AS complaint_type,
    "Descriptor" AS descriptor,
    "Street Name" AS street_name,
    REGEXP_EXTRACT(
        "Incident Address",
        CONCAT('([0-9\\-]+) ', street_name),
        1
    ) AS street_number,
    "Borough" AS borough,
    CASE
        WHEN "Borough" = 'MANHATTAN' THEN 'NEW YORK'
        WHEN "Borough" = 'BROOKLYN' THEN 'KINGS'
        WHEN "Borough" = 'QUEENS' THEN 'QUEENS'
        WHEN "Borough" = 'BRONX' THEN 'BRONX'
        WHEN "Borough" = 'STATEN ISLAND' THEN 'RICHMOND'
        ELSE 'Unspecified'
    END AS county,
    "Incident Zip" AS incident_zip,
    "Latitude" AS latitude,
    "Longitude" AS longitude
FROM
    read_parquet('{object_url}');