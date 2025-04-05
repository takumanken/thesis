CREATE OR REPLACE VIEW {object_name} AS
SELECT
    "Unique Key" AS unique_key,
    "Status" AS status,
    "Created Date" AS created_timestamp,
    cast(created_timestamp as date) as created_date,
    date_trunc('week', created_timestamp) as created_week,
    date_trunc('month', created_timestamp) as created_month,
    date_trunc('year', created_timestamp) as created_year,
    year(created_timestamp) as created_year_datepart,
    month(created_timestamp) as created_month_datepart,
    day(created_timestamp) as created_day_datepart,
    hour(created_timestamp) as created_hour_datepart,
    strftime('%a', created_timestamp) as created_weekday_datepart,
    "Closed Date" AS closed_timestamp,
    cast(closed_timestamp as date) as closed_date,
    year(closed_timestamp) as closed_year_datepart,
    month(closed_timestamp) as closed_month_datepart,
    day(closed_timestamp) as closed_day_datepart,
    hour(closed_timestamp) as closed_hour_datepart,
    strftime('%a', closed_timestamp) as closed_weekday_datepart,
    datesub('second', created_timestamp, closed_timestamp) as time_to_resolve_sec,
    "Agency" AS agency,
    "Agency Name" AS agency_name,
    "Complaint Type" AS complaint_type,
    lower(complaint_type) like '%noise%' AS is_noise_complaint,
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