INSTALL spatial;
LOAD spatial;

CREATE OR REPLACE VIEW {object_name} AS
SELECT
    "Unique Key" AS unique_key,
    "Status" AS status,
    cast("Created Date" as timestamp) AS created_timestamp,
    cast(created_timestamp as date) AS created_date,
    date_trunc('week', created_timestamp) AS created_week,
    date_trunc('month', created_timestamp) AS created_month,
    date_trunc('year', created_timestamp) AS created_year,
    month(created_timestamp) AS created_month_datepart,
    day(created_timestamp) AS created_day_datepart,
    hour(created_timestamp) AS created_hour_datepart,
    strftime('%a', created_timestamp) AS created_weekday_datepart,
    dayofweek(created_timestamp) AS created_weekday_order,
    cast("Closed Date" as timestamp) AS closed_timestamp,
    cast(closed_timestamp as date) AS closed_date,
    year(closed_timestamp) AS closed_year_datepart,
    month(closed_timestamp) AS closed_month_datepart,
    day(closed_timestamp) AS closed_day_datepart,
    hour(closed_timestamp) AS closed_hour_datepart,
    strftime('%a', closed_timestamp) AS closed_weekday_datepart,
    dayofweek(closed_timestamp) AS closed_weekday_order,
    datesub('second', created_timestamp, closed_timestamp) AS time_to_resolve_sec,
    round(time_to_resolve_sec/60/60/24) AS time_to_resolve_day,
    IFNULL("Agency Name", 'Unspecified') AS agency_name,
    CASE
        WHEN agency_name = 'Department of Housing Preservation and Development' THEN 'Housing'
        WHEN agency_name = 'Department of Transportation' THEN 'Transportation'
        WHEN agency_name = 'New York City Police Department' THEN 'Public Safety'
        WHEN agency_name = 'Department of Sanitation' THEN 'Sanitation'
        WHEN agency_name = 'Department of Environmental Protection' THEN 'Environmental'
        WHEN agency_name = 'Department of Buildings' THEN 'Building'
        WHEN agency_name = 'Department of Parks and Recreation' THEN 'Parks & Recreation'
        WHEN agency_name = 'Department of Health and Mental Hygiene' THEN 'Health'
        WHEN agency_name = 'DHS Advantage Programs' THEN 'Human Services'
        WHEN agency_name = 'Taxi and Limousine Commission' THEN 'Transportation'
        WHEN agency_name = 'Department of Consumer and Worker Protection' THEN 'Consumer Affairs'
        WHEN agency_name LIKE 'School - %' THEN 'Schools'
        ELSE 'Others'
    END AS agency_category,
    CASE 
        -- Noise Issues
        WHEN "Complaint Type" LIKE 'Noise%' OR
             "Complaint Type" IN ('Helicopter Noise')
        THEN 'Noise Issues'
        
        -- Housing & Building
        WHEN "Complaint Type" IN ('HEAT/HOT WATER', 'PLUMBING', 'PAINT/PLASTER', 'DOOR/WINDOW',
                                'WATER LEAK', 'GENERAL', 'ELECTRIC', 'FLOORING/STAIRS', 
                                'APPLIANCE', 'Elevator', 'SAFETY', 'Heat/Hot Water',
                                'Plumbing', 'Paint/Plaster', 'Door/Window', 'Electric',
                                'Flooring/Stairs', 'Appliance', 'Safety', 'Building/Use', 
                                'Lead', 'Mold', 'OUTSIDE BUILDING', 'Indoor Air Quality',
                                'Non-Residential Heat', 'ELEVATOR', 'Boilers', 
                                'CONSTRUCTION', 'GENERAL CONSTRUCTION', 'Building Condition',
                                'General Construction/Plumbing', 'Scaffold Safety')
        THEN 'Housing & Building'
        
        -- Parking & Street Access
        WHEN "Complaint Type" IN ('Illegal Parking', 'Blocked Driveway', 
                                'Traffic/Illegal Parking')
        THEN 'Parking & Street Access'
        
        -- Street & Infrastructure
        WHEN "Complaint Type" IN ('Street Condition', 'Traffic Signal Condition', 
                                'Street Light Condition', 'Sidewalk Condition',
                                'Curb Condition', 'Street Sign - Damaged', 
                                'Street Sign - Missing', 'Highway Condition',
                                'Bridge Condition', 'Street Sign - Dangling',
                                'Broken Parking Meter', 'Highway Sign - Damaged',
                                'Highway Sign - Missing', 'Highway Sign - Dangling',
                                'Root/Sewer/Sidewalk Condition', 'Snow',
                                'Tunnel Condition')
        THEN 'Street & Infrastructure'
        
        -- Sanitation Issues
        WHEN "Complaint Type" IN ('UNSANITARY CONDITION', 'Dirty Condition', 
                               'Missed Collection', 'Illegal Dumping',
                               'Dirty Conditions', 'Rodent', 'Dead Animal',
                               'Missed Collection (All Materials)', 'Sanitation Condition',
                               'Sweeping/Missed-Inadequate', 'Litter Basket / Request',
                               'Overflowing Litter Baskets', 'Residential Disposal Complaint',
                               'Unsanitary Condition', 'Request Large Bulky Item Collection', 
                               'Street Sweeping Complaint', 'Sanitation Worker or Vehicle Complaint',
                               'Commercial Disposal Complaint', 'Unsanitary Pigeon Condition')
        THEN 'Sanitation Issues'
        
        -- Vehicle Concerns
        WHEN "Complaint Type" IN ('Abandoned Vehicle', 'Derelict Vehicle', 'Derelict Vehicles', 
                                'For Hire Vehicle Complaint', 'Taxi Complaint',
                                'For Hire Vehicle Report', 'Taxi Report',
                                'Green Taxi Complaint', 'Ferry Complaint',
                                'Ferry Inquiry', 'Derelict Bicycle',
                                'Taxi Compliment', 'Taxi Licensee Complaint')
        THEN 'Vehicle Concerns'
        
        -- Public Safety & Order
        WHEN "Complaint Type" IN ('Drug Activity', 'Illegal Fireworks',
                                'Panhandling', 'Smoking', 'Drinking',
                                'Urinating in Public', 'Disorderly Youth',
                                'Non-Emergency Police Matter', 'Graffiti',
                                'Obstruction', 'Illegal Animal Kept as Pet',
                                'Bike/Roller/Skate Chronic', 'Animal-Abuse',
                                'Real Time Enforcement', 'Violation of Park Rules',
                                'Unleashed Dog', 'Face Covering Violation',
                                'Vaccine Mandate Non-Compliance')
        THEN 'Public Safety & Order'
        
        -- Environmental & Green Space
        WHEN "Complaint Type" IN ('Water System', 'Damaged Tree',
                                'Overgrown Tree/Branches', 'New Tree Request',
                                'Dead Tree', 'Dead/Dying Tree', 'Air Quality',
                                'Illegal Tree Damage', 'Water Quality',
                                'Water Conservation', 'Sewer',
                                'Harboring Bees/Wasps', 'Mosquitoes',
                                'Standing Water', 'Poison Ivy',
                                'Plant', 'Animal in a Park', 'Sewer Maintenance',
                                'Beach/Pool/Sauna Complaint')
        THEN 'Environmental & Green Space'
        
        -- Commercial & Consumer Issues
        WHEN "Complaint Type" IN ('Consumer Complaint', 'Food Establishment',
                                'Vendor Enforcement', 'Mobile Food Vendor',
                                'Outdoor Dining', 'Food Poisoning',
                                'Special Projects Inspection Team (SPIT)',
                                'Illegal Posting', 'Day Care',
                                'Pet Shop', 'Maintenance or Facility',
                                'Dumpster Complaint', 'Business Complaint',
                                'School Maintenance', 'Industrial Waste',
                                'Calorie Labeling', 'Trans Fat', 'Tattooing')
        THEN 'Commercial & Consumer Issues'
        
        -- Public Assistance
        WHEN "Complaint Type" IN ('Homeless Person Assistance', 'Homeless Encampment',
                                'Encampment', 'Social Services', 'Elder Abuse',
                                'Senior Center Complaint', 'Alzheimer''s Care',
                                'Home Care Provider Complaint', 'Home Delivered Meal - Missed Delivery',
                                'HEAP Assistance')
        THEN 'Public Assistance'
        
        -- All others
        ELSE 'Others'
    END AS complaint_type_large,
    IFNULL("Complaint Type", 'Unspecified') AS complaint_type_middle,
    IFNULL("Descriptor", 'Unspecified') AS complaint_type_detailed,
    IFNULL("Borough", 'Unspecified') AS borough,
    CASE
        WHEN IFNULL("Borough", 'Unspecified') = 'MANHATTAN' THEN 'NEW YORK'
        WHEN IFNULL("Borough", 'Unspecified') = 'BROOKLYN' THEN 'KINGS'
        WHEN IFNULL("Borough", 'Unspecified') = 'QUEENS' THEN 'QUEENS'
        WHEN IFNULL("Borough", 'Unspecified') = 'BRONX' THEN 'BRONX'
        WHEN IFNULL("Borough", 'Unspecified') = 'STATEN ISLAND' THEN 'RICHMOND'
        ELSE 'Unspecified'
    END AS county,
    IFNULL("Incident Zip", 'Unspecified') AS incident_zip,
    ST_Point2D(latitude, longitude) AS location,
    IFNULL(neighborhood_code, 'Unspecified') AS neighborhood_code,
    IFNULL(neighborhood_name, 'Unspecified') AS neighborhood_name,
    IFNULL("Community Board", 'Unspecified') AS community_board,
    IFNULL("Location Type", 'Unspecified') AS location_type,
    IFNULL("Address Type", 'Unspecified') AS address_type,
    IFNULL("Open Data Channel Type", 'Unspecified') AS open_data_channel_type,
    1 as num_of_requests
FROM
    read_parquet('data/requests_311.parquet');