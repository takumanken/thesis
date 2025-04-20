/**
 * About Data Module
 * Displays metadata about the current visualization
 */
import { state } from "./state.js";
import { chartStyles } from "./chart/utils/chartStyles.js";

// Schema cache
let dataSchemaCache = null;

/**
 * Update the About Data section
 */
export async function updateAboutData() {
  const containers = {
    attributes: document.querySelector(".viz-dimensions .dimension-tags"),
    measures: document.querySelector(".viz-metrics .metrics-tags"),
    filters: document.querySelector(".viz-filters .filter-tags"),
  };

  // Validate containers
  if (!containers.attributes || !containers.measures || !containers.filters) {
    console.error("About Data containers not found");
    return;
  }

  // Clear containers
  Object.values(containers).forEach((container) => (container.innerHTML = ""));

  // Create tooltip
  const tooltip = chartStyles.createTooltip();

  try {
    // Load schema
    const schema = await loadDataSchema();

    // Update sections
    updateAttributesSection(containers.attributes, tooltip, schema);
    updateMeasuresSection(containers.measures, tooltip, schema);
    updateFiltersSection(containers.filters, tooltip, schema);
  } catch (error) {
    console.error("Error updating About Data section:", error);
  }
}

/**
 * Update the Attributes section
 */
function updateAttributesSection(container, tooltip, schema) {
  const dimensions = getStateDimensions();

  if (dimensions.length === 0) {
    container.innerHTML = "<span class='empty-message'>No attributes in this visualization</span>";
    return;
  }

  dimensions.forEach((dimension) => {
    const info = findDimensionInSchema(dimension, schema);
    if (!info) return;

    const iconName = getDimensionTypeIcon(info.data_type);
    const pill = createPill(
      iconName,
      info.display_name || dimension,
      info.description_to_user || "Dimension attribute",
      tooltip
    );

    container.appendChild(pill);
  });
}

/**
 * Update the Measures section
 */
function updateMeasuresSection(container, tooltip, schema) {
  const measures = getStateMeasures();

  if (measures.length === 0) {
    container.innerHTML = "<span class='empty-message'>No measures in this visualization</span>";
    return;
  }

  measures.forEach((measure) => {
    const info = findMeasureInSchema(measure, schema);
    if (!info) return;

    const iconName = getMeasureTypeIcon(info.data_type);
    const pill = createPill(
      iconName,
      info.display_name || measure,
      info.description_to_user || "Measure attribute",
      tooltip
    );

    container.appendChild(pill);
  });
}

/**
 * Update the Filters section including period pill
 */
function updateFiltersSection(container, tooltip, schema) {
  // Add period pill first
  addDateRangePill(container, tooltip);

  // Add other filters
  const filters = state.dataInsights?.filter_description || [];
  const preFilters = state.aggregationDefinition?.preAggregationFilters;
  const postFilters = state.aggregationDefinition?.postAggregationFilters;

  // If no filters at all and no period pill was added
  if (filters.length === 0 && !preFilters && !postFilters && container.childElementCount === 0) {
    container.innerHTML = "<span class='empty-message'>No filters applied</span>";
    return;
  }

  // Add filter pills from filter_description array
  if (Array.isArray(filters)) {
    filters.forEach((filter) => {
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
  } else if (typeof filters === "string" && filters) {
    container.appendChild(createPill("filter_alt", "Filter", filters, tooltip));
  }

  // Add pre/post filters if needed
  if (preFilters && filters.length === 0) {
    container.appendChild(createPill("filter_alt", "Pre-filter", `Filter: ${preFilters}`, tooltip));
  }

  if (postFilters) {
    container.appendChild(createPill("filter_alt", "Post-filter", `Filter: ${postFilters}`, tooltip));
  }
}

/**
 * Add date range pill to container if date range exists
 */
function addDateRangePill(container, tooltip) {
  const dateRange = state.aggregationDefinition?.createdDateRange;

  if (!dateRange || !Array.isArray(dateRange) || dateRange.length < 2) return;

  const [minDate, maxDate] = dateRange;
  if (!minDate || !maxDate) return;

  // Format for display and tooltip
  const formattedRange = formatDateRange(minDate, maxDate);
  const fromDate = formatDate(minDate);
  const toDate = formatDate(maxDate);

  const tooltipText = `Limited to requests created between ${fromDate} and ${toDate}`;
  const pill = createPill("date_range", formattedRange, tooltipText, tooltip, "period");

  container.appendChild(pill);
}

/**
 * Create a pill element with tooltip
 */
function createPill(iconName, text, description, tooltip, extraClass = "") {
  const pill = document.createElement("div");
  pill.className = `tag-item ${extraClass}`;
  pill.innerHTML = `
    <span class="material-icons" style="font-size: 16px; margin-right: 4px;">${iconName}</span>
    <span>${text}</span>
  `;

  // Add tooltip
  d3.select(pill)
    .on("mousemove", (event) => chartStyles.tooltip.show(tooltip, event, description))
    .on("mouseleave", () => chartStyles.tooltip.hide(tooltip));

  return pill;
}

/**
 * Format date range for display
 */
function formatDateRange(minDate, maxDate) {
  const formatShort = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return `${formatShort(minDate)} - ${formatShort(maxDate)}`;
}

/**
 * Format date for tooltip
 */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get icon for dimension type
 */
function getDimensionTypeIcon(dataType) {
  switch ((dataType || "string").toLowerCase()) {
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
 * Get icon for measure type
 */
function getMeasureTypeIcon(dataType) {
  switch ((dataType || "number").toLowerCase()) {
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
  const agg = state.aggregationDefinition || {};
  const dimensions = [];

  // Regular dimensions
  if (Array.isArray(agg.dimensions)) {
    dimensions.push(...agg.dimensions);
  }

  // Specialized dimensions
  ["timeDimension", "geoDimension", "categoricalDimension"].forEach((type) => {
    if (Array.isArray(agg[type])) {
      dimensions.push(...agg[type]);
    }
  });

  return [...new Set(dimensions)]; // Remove duplicates
}

/**
 * Get all measures from state
 */
function getStateMeasures() {
  const measures = state.aggregationDefinition?.measures;
  if (!Array.isArray(measures)) return [];

  return measures.map((m) => m.alias).filter(Boolean);
}

/**
 * Find field in schema (dimension or measure)
 */
function findFieldInSchema(fieldName, schema) {
  return findDimensionInSchema(fieldName, schema) || findMeasureInSchema(fieldName, schema);
}

/**
 * Find dimension in schema
 */
function findDimensionInSchema(dimensionName, schema) {
  if (!schema?.dimensions || !dimensionName) return null;

  // Search in dimension types
  for (const type of ["time_dimension", "geo_dimension", "categorical_dimension"]) {
    const dimensions = schema.dimensions[type];
    if (!dimensions) continue;

    const found = dimensions.find((dim) => dim.physical_name === dimensionName);
    if (found) return found;
  }

  return null;
}

/**
 * Find measure in schema
 */
function findMeasureInSchema(measureName, schema) {
  if (!schema?.measures || !measureName) return null;
  return schema.measures.find((m) => m.physical_name === measureName);
}

/**
 * Load the data schema
 */
async function loadDataSchema() {
  // Return cached schema if available
  if (dataSchemaCache) return dataSchemaCache;

  try {
    // Primary schema path
    const response = await fetch("../backend/assets/gemini_instructions/references/data_schema.json");

    if (response.ok) {
      dataSchemaCache = await response.json();
      return dataSchemaCache;
    }

    // Fallback to empty schema
    return {
      dimensions: {
        time_dimension: [],
        geo_dimension: [],
        categorical_dimension: [],
      },
      measures: [],
    };
  } catch (error) {
    console.warn("Error loading data schema:", error.message);
    return {
      dimensions: { time_dimension: [], geo_dimension: [], categorical_dimension: [] },
      measures: [],
    };
  }
}
