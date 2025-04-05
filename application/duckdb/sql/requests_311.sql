CREATE OR REPLACE VIEW {object_name} AS
SELECT
    "Unique Key" AS unique_key,
    "Status" AS status,
    "Created Date" AS created_timestamp,
    cast(created_timestamp as date) AS created_date,
    date_trunc('week', created_timestamp) AS created_week,
    date_trunc('month', created_timestamp) AS created_month,
    date_trunc('year', created_timestamp) AS created_year,
    year(created_timestamp) AS created_year_datepart,
    month(created_timestamp) AS created_month_datepart,
    day(created_timestamp) AS created_day_datepart,
    hour(created_timestamp) AS created_hour_datepart,
    strftime('%a', created_timestamp) AS created_weekday_datepart,
    "Closed Date" AS closed_timestamp,
    cast(closed_timestamp as date) AS closed_date,
    year(closed_timestamp) AS closed_year_datepart,
    month(closed_timestamp) AS closed_month_datepart,
    day(closed_timestamp) AS closed_day_datepart,
    hour(closed_timestamp) AS closed_hour_datepart,
    strftime('%a', closed_timestamp) AS closed_weekday_datepart,
    datesub('second', created_timestamp, closed_timestamp) AS time_to_resolve_sec,
    "Agency" AS agency,
    "Agency Name" AS agency_name,
    CASE 
        WHEN "Complaint Type" IN ('Building Condition', 'Building/Use', 'Street Condition', 'Street Light Condition', 'Street Sign - Damaged', 'Street Sign - Dangling', 'Street Sign - Missing', 'Public Toilet', 'Public Payphone Complaint') 
            THEN 'Public Infrastructure & Facilities'
        WHEN "Complaint Type" IN ('Air Quality', 'Indoor Air Quality', 'Asbestos', 'Hazardous Material', 'Hazardous Materials', 'Mold', 'Recycling Enforcement', 'Sanitation Condition', 'Water Conservation', 'Water Maintenance', 'Water Quality', 'Water System', 'Weatherization')
            THEN 'Environmental & Sanitation'
        WHEN "Complaint Type" IN ('Noise', 'Noise - Commercial', 'Noise - Helicopter', 'Noise - House of Worship', 'Noise - Park', 'Noise - Residential', 'Noise - Street/Sidewalk', 'Noise - Vehicle', 'Non-Residential Heat', 'HEATING')
            THEN 'Public Safety & Health'
        WHEN "Complaint Type" IN ('Broken Muni Meter', 'Broken Parking Meter', 'DOF Parking - Address Update', 'DOF Parking - DMV Clearance', 'DOF Parking - Payment Issue', 'DOF Parking - Request Copy', 'DOF Parking - Request Status', 'DOF Parking - Tax Exemption', 'Traffic', 'Traffic Signal Condition', 'Traffic/Illegal Parking', 'Taxi Complaint', 'Taxi Compliment') 
            THEN 'Transportation & Traffic'
        WHEN "Complaint Type" IN (
                'DHS Advantage - Tenant', 'DHS Advantage - Third Party', 'DHS Advantage -Landlord/Broker',
                'DHS Income Savings Requirement', 'DOF Property - City Rebate', 'DOF Property - Owner Issue',
                'DOF Property - Payment Issue', 'DOF Property - Property Value', 'DOF Property - RPIE Issue',
                'DOF Property - Reduction Issue', 'DOF Property - Request Copy', 'DOF Property - State Rebate',
                'Registration and Transfers', 'Legal Services Provider Complaint', 'Consumer Complaint',
                'Case Management Agency Complaint', 'Investigations and Discipline (IAD)'
             )
            THEN 'Administrative & Regulatory'
        ELSE 'Miscellaneous'
    END AS complaint_category,
    "Complaint Type" AS complaint_type,
    "Descriptor" AS complaint_descriptor,
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