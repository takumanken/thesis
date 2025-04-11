# Chart Type Classification Rules

Chart type will be added as available chart types when the respose data strucutre meets the following criteria.

## Table
- Always available as fallback visualization
- Requires at least one field (dimension or measure)

## Single Bar Chart
- Dimension == 1
- Measure == 1
- No Time Dimension

## Line Chart
- Time Dimension == 1
- Categorical Dimensions <= 1
- Measure == 1

## Nested Bar Chart
- 1 <= Categorical Dimensions <= 2
- 1 <= Measure <= 2

## Grouped Bar Chart
- Categorical Dimensions == 2
- Measures == 1

## Stacked Bar Chart
- Categorical Dimensions == 2
- Measures == 1

## Treemap
- 1 <= Categorical Dimensions <= 2
- Measures == 1

## Heat Map
- Geographic Dimension == 1
- Dimension contains "location" (coordinate data)
- Measure == 1

## Choropleth Map
- Geographic Dimension == 1
- Dimension is geographic area (borough, county, neighborhood)
- Measure == 1

## Text
- Special type for text-only responses
- No data visualization, just formatted text

# Ideal Chart selection Rules

Chart type will be selected as the ideal visualization when the data structure meets the following criteria. Rules are applied in order of precedence.

## Table
- Default fallback when no other chart type is selected as ideal
- Used when data doesn't match criteria for other chart types

## Single Bar Chart
- Categorical Dimension == 1
- Measure == 1

## Line Chart
- Time Dimension == 1
- Categorical Dimensions <= 1
- Measure == 1

## Nested Bar Chart
- 1 <= Categorical Dimensions <= 2
- 1 <= Measure <= 2
- AND either dimension or measure must be more than 1

## Grouped Bar Chart
- Categorical Dimensions == 2
- Measure == 1

## Heat Map
- Geographic Dimension == "location"
- No other dimensions
- Measure == 1

## Choropleth Map
- Geographic Dimension == "borough"　or "county" or "neighborhood"
- No other dimensions
- Measure == 1

## Text
- Special case for text-only responses
- No data visualization

# Chart Type Selection Flowchart

Is it a text-only response?
├── Yes → TEXT
└── No → Continue

Check dimensions and measures:
├── No dimensions AND no measures → TABLE
└── At least one dimension OR measure → Continue

    Check for geographic dimension:
    ├── Has exactly 1 geographic dimension AND exactly 1 measure AND no other dimensions → Continue
    │   ├── Dimension contains "location" → HEAT MAP
    │   └── Dimension contains "borough"/"county"/"neighborhood" → CHOROPLETH MAP
    └── Not a geographic-only query → Continue

        Check for time dimension:
        ├── Has exactly 1 time dimension AND ≤ 1 categorical dimension AND exactly 1 measure → LINE CHART
        └── Not a time series query → Continue

            Check for categorical dimensions:
            ├── Has exactly 1 categorical dimension AND exactly 1 measure AND no time dimensions → SINGLE BAR CHART
            ├── Has 1-2 categorical dimensions AND 1-2 measure → NESTED BAR CHART
            └── None of the above → TABLE