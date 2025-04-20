/**
 * About Data Section Module
 * Handles displaying metadata about the current visualization
 */
import { state } from "./state.js";
import { chartStyles } from "./chart/utils/chartStyles.js";

// Cache for loaded schema
let dataSchemaCache = null;

/**
 * Main function to update the About Data section
 */
export async function updateAboutDataSection() {
  // Containers
  const periodContainer = document.querySelector(".viz-period .period-tags");
  const attributesContainer = document.querySelector(".viz-dimensions .dimension-tags");
  const measuresContainer = document.querySelector(".viz-metrics .metrics-tags");
  const filtersContainer = document.querySelector(".viz-filters .filter-tags");

  if (!periodContainer || !attributesContainer || !measuresContainer || !filtersContainer) {
    console.error("About Data containers not found");
    return;
  }

  // Clear existing content
  periodContainer.innerHTML = "";
  attributesContainer.innerHTML = "";
  measuresContainer.innerHTML = "";
  filtersContainer.innerHTML = "";

  // Create D3 tooltip for consistent styling
  const tooltip = chartStyles.createTooltip();

  try {
    // Load data schema for field labels and descriptions
    const schema = await loadDataSchema();

    // 1. Display period (date range)
    updatePeriodSection(periodContainer, tooltip);

    // 2. Display attributes (dimensions)
    updateAttributesSection(attributesContainer, tooltip, schema);

    // 3. Display measures
    updateMeasuresSection(measuresContainer, tooltip, schema);

    // 4. Display filters
    updateFiltersSection(filtersContainer, tooltip, schema);
  } catch (error) {
    console.error("Error updating About Data section:", error);
  }
}

/**
 * Update the Period section with date range information
 */
function updatePeriodSection(container, tooltip) {
  const dateRange = state.aggregationDefinition?.createdDateRange;

  if (dateRange && Array.isArray(dateRange) && dateRange.length >= 2) {
    const minDate = dateRange[0];
    const maxDate = dateRange[1];

    if (minDate && maxDate) {
      const formattedDateRange = formatDateRange(minDate, maxDate);

      const periodPill = createPill(
        "date_range",
        formattedDateRange,
        "Date range of 311 requests in the dataset.",
        tooltip
      );

      container.appendChild(periodPill);
      return;
    }
  }

  // If we get here, there's no valid date range
  container.innerHTML = "<span class='empty-message'>No date range specified</span>";
}

/**
 * Update the Attributes section with dimensions information
 */
function updateAttributesSection(container, tooltip, schema) {
  const dimensions = getStateDimensions();

  if (!dimensions.length) {
    container.innerHTML = "<span class='empty-message'>No attributes in this visualization</span>";
    return;
  }

  dimensions.forEach((dimension) => {
    const dimensionInfo = findDimensionInSchema(dimension, schema);
    if (!dimensionInfo) return;

    const iconName = getDimensionTypeIcon(dimensionInfo.data_type || "string");
    const pill = createPill(
      iconName,
      dimensionInfo.display_name || dimension,
      dimensionInfo.description_to_user || "Dimension attribute",
      tooltip
    );

    container.appendChild(pill);
  });
}

/**
 * Update the Measures section with information about measures
 */
function updateMeasuresSection(container, tooltip, schema) {
  const measures = getStateMeasures();

  if (!measures.length) {
    container.innerHTML = "<span class='empty-message'>No measures in this visualization</span>";
    return;
  }

  measures.forEach((measure) => {
    const measureInfo = findMeasureInSchema(measure, schema);
    if (!measureInfo) return;

    const iconName = getMeasureTypeIcon(measureInfo.data_type || "number");
    const pill = createPill(
      iconName,
      measureInfo.display_name || measure,
      measureInfo.description_to_user || "Measure attribute",
      tooltip
    );

    container.appendChild(pill);
  });
}

/**
 * Update the Filters section with filter information
 */
function updateFiltersSection(container, tooltip, schema) {
  // Get filter descriptions from state
  const filters = state.dataInsights?.filter_description || [];

  // Also check for preAggregationFilters and postAggregationFilters in aggregationDefinition
  const preFilters = state.aggregationDefinition?.preAggregationFilters;
  const postFilters = state.aggregationDefinition?.postAggregationFilters;

  if (filters.length === 0 && !preFilters && !postFilters) {
    container.innerHTML = "<span class='empty-message'>No filters applied</span>";
    return;
  }

  // Add filter pills from filter_description array
  if (Array.isArray(filters)) {
    filters.forEach((filter) => {
      // Find the field in schema for better display
      const fieldName = filter.filtered_field_name || filter.field || "Filter";
      const fieldInfo = findFieldInSchema(fieldName, schema);

      const pill = createPill(
        "filter_alt",
        fieldInfo?.display_name || fieldName,
        filter.description || "Applied filter",
        tooltip
      );

      container.appendChild(pill);
    });
  } else if (typeof filters === "string" && filters.length > 0) {
    // Handle case where filter_description is a string
    const pill = createPill("filter_alt", "Filter", filters, tooltip);
    container.appendChild(pill);
  }

  // Add preAggregationFilters if not already covered
  if (preFilters && filters.length === 0) {
    const pill = createPill("filter_alt", "Pre-aggregation Filter", `Filter: ${preFilters}`, tooltip);

    container.appendChild(pill);
  }

  // Add postAggregationFilters if present
  if (postFilters && postFilters.length > 0) {
    const pill = createPill("filter_alt", "Post-aggregation Filter", `Filter: ${postFilters}`, tooltip);

    container.appendChild(pill);
  }
}

/**
 * Create a pill element with tooltip
 */
function createPill(iconName, text, description, tooltip) {
  const pill = document.createElement("div");
  pill.className = "tag-item";
  pill.innerHTML = `
    <span class="material-icons" style="font-size: 16px; margin-right: 4px;">${iconName}</span>
    <span>${text}</span>
  `;

  // Add tooltip using D3
  d3.select(pill)
    .on("mousemove", function (event) {
      chartStyles.tooltip.show(tooltip, event, description);
    })
    .on("mouseleave", function () {
      chartStyles.tooltip.hide(tooltip);
    });

  return pill;
}

/**
 * Format date range for display
 */
function formatDateRange(minDate, maxDate) {
  if (!minDate || !maxDate) return "Date range unavailable";

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return `${formatDate(minDate)} - ${formatDate(maxDate)}`;
}

/**
 * Get appropriate icon for dimension type
 */
function getDimensionTypeIcon(dataType) {
  switch (dataType.toLowerCase()) {
    case "date":
      return "calendar_today";
    case "point":
    case "geo":
      return "location_on";
    case "string":
      return "abc";
    case "integer":
    case "number":
    case "float":
      return "tag";
    default:
      return "label";
  }
}

/**
 * Get appropriate icon for measure type
 */
function getMeasureTypeIcon(dataType) {
  switch (dataType.toLowerCase()) {
    case "integer":
      return "tag";
    case "float":
    case "number":
      return "functions";
    case "percentage":
      return "percent";
    default:
      return "functions";
  }
}

/**
 * Get all dimensions from state
 */
function getStateDimensions() {
  const agg = state.aggregationDefinition;
  const dimensions = [];

  // Add regular dimensions
  if (agg.dimensions && Array.isArray(agg.dimensions)) {
    dimensions.push(...agg.dimensions);
  }

  // Add specialized dimensions
  ["timeDimension", "geoDimension", "categoricalDimension"].forEach((dimType) => {
    if (agg[dimType] && Array.isArray(agg[dimType])) {
      dimensions.push(...agg[dimType]);
    }
  });

  return [...new Set(dimensions)]; // Remove duplicates
}

/**
 * Get all measures from state
 */
function getStateMeasures() {
  const agg = state.aggregationDefinition;
  if (!agg.measures || !Array.isArray(agg.measures)) return [];

  return agg.measures.map((m) => m.alias).filter(Boolean);
}

/**
 * Find dimension info in the schema
 */
function findDimensionInSchema(dimensionName, schema) {
  if (!schema || !schema.dimensions) return null;

  // Search in each dimension type
  for (const dimType of ["time_dimension", "geo_dimension", "categorical_dimension"]) {
    const found = (schema.dimensions[dimType] || []).find((dim) => dim.physical_name === dimensionName);
    if (found) return found;
  }

  return null;
}

/**
 * Find measure info in the schema
 */
function findMeasureInSchema(measureName, schema) {
  if (!schema || !schema.measures) return null;

  return schema.measures.find((m) => m.physical_name === measureName);
}

/**
 * Find any field in the schema (dimension or measure)
 */
function findFieldInSchema(fieldName, schema) {
  // First check dimensions
  const dimension = findDimensionInSchema(fieldName, schema);
  if (dimension) return dimension;

  // Then check measures
  return findMeasureInSchema(fieldName, schema);
}

/**
 * Load the data schema JSON file
 * @returns {Promise<Object>} The data schema
 */
async function loadDataSchema() {
  if (dataSchemaCache) {
    return dataSchemaCache;
  }

  try {
    const response = await fetch("../backend/assets/gemini_instructions/references/data_schema.json");
    if (!response.ok) {
      throw new Error(`Failed to load schema: ${response.status}`);
    }

    dataSchemaCache = await response.json();
    return dataSchemaCache;
  } catch (error) {
    console.error("Error loading data schema:", error);

    // Return empty schema structure on error
    return {
      dimensions: {
        time_dimension: [],
        geo_dimension: [],
        categorical_dimension: [],
      },
      measures: [],
    };
  }
}
