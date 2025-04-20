/**
 * About Data Module
 * Displays metadata about the current visualization
 */
import { state } from "./state.js";
import { chartStyles } from "./chart/utils/chartStyles.js";

// Schema cache
let dataSchemaCache = null;

// Empty schema structure for fallbacks
const EMPTY_SCHEMA = {
  dimensions: {
    time_dimension: [],
    geo_dimension: [],
    categorical_dimension: [],
  },
  measures: [],
};

/**
 * Update the About Data section
 */
export async function updateAboutData() {
  // Get containers
  const containers = {
    attributes: document.querySelector(".viz-dimensions .dimension-tags"),
    measures: document.querySelector(".viz-metrics .metrics-tags"),
    filters: document.querySelector(".viz-filters .filter-tags"),
  };

  // Quick validation
  if (!Object.values(containers).every(Boolean)) {
    console.error("About Data containers not found");
    return;
  }

  // Clear containers
  Object.values(containers).forEach((container) => (container.innerHTML = ""));

  // Load schema and update UI
  const schema = await loadDataSchema();
  const tooltip = chartStyles.createTooltip();

  updateAttributesSection(containers.attributes, tooltip, schema);
  updateMeasuresSection(containers.measures, tooltip, schema);
  updateFiltersSection(containers.filters, tooltip, schema);
}

/**
 * Update the Attributes section
 */
function updateAttributesSection(container, tooltip, schema) {
  const dimensions = getStateDimensions();

  if (!dimensions.length) {
    container.innerHTML = "<span class='empty-message'>No attributes in this visualization</span>";
    return;
  }

  dimensions.forEach((dimension) => {
    const info = findDimensionInSchema(dimension, schema);
    const iconName = getDimensionTypeIcon(info?.data_type);

    container.appendChild(
      createPill(iconName, info?.display_name || dimension, info?.description_to_user || "Dimension attribute", tooltip)
    );
  });
}

/**
 * Update the Measures section
 */
function updateMeasuresSection(container, tooltip, schema) {
  const measures = getStateMeasures();

  if (!measures.length) {
    container.innerHTML = "<span class='empty-message'>No measures in this visualization</span>";
    return;
  }

  measures.forEach((measure) => {
    const info = findMeasureInSchema(measure, schema);
    const iconName = getMeasureTypeIcon(info?.data_type);

    container.appendChild(
      createPill(iconName, info?.display_name || measure, info?.description_to_user || "Measure attribute", tooltip)
    );
  });
}

/**
 * Update the Filters section including period pill
 */
function updateFiltersSection(container, tooltip, schema) {
  // Add period pill first
  addDateRangePill(container, tooltip);

  // Get filter data
  const filters = state.dataInsights?.filter_description || [];
  const preFilters = state.aggregationDefinition?.preAggregationFilters;
  const postFilters = state.aggregationDefinition?.postAggregationFilters;

  // Show empty message if needed
  if (!filters.length && !preFilters && !postFilters && !container.childElementCount) {
    container.innerHTML = "<span class='empty-message'>No filters applied</span>";
    return;
  }

  // Add filter pills from array
  if (Array.isArray(filters)) {
    filters.forEach((filter) => {
      const fieldName = filter.filtered_field_name || filter.field || "Filter";
      const fieldInfo = findFieldInSchema(fieldName, schema);

      container.appendChild(
        createPill("filter_alt", fieldInfo?.display_name || fieldName, filter.description || "Applied filter", tooltip)
      );
    });
  } else if (typeof filters === "string" && filters) {
    container.appendChild(createPill("filter_alt", "Filter", filters, tooltip));
  }

  // Add pre/post filters if needed
  if (preFilters && !filters.length) {
    container.appendChild(createPill("filter_alt", "Pre-filter", `Filter: ${preFilters}`, tooltip));
  }

  if (postFilters) {
    container.appendChild(createPill("filter_alt", "Post-filter", `Filter: ${postFilters}`, tooltip));
  }
}

/**
 * Add date range pill to container
 */
function addDateRangePill(container, tooltip) {
  const dateRange = state.aggregationDefinition?.createdDateRange;
  if (!dateRange?.length || dateRange.length < 2) return;

  const [minDate, maxDate] = dateRange;
  if (!minDate || !maxDate) return;

  // Format dates
  const formattedRange = `${formatDate(minDate, true)} - ${formatDate(maxDate, true)}`;
  const tooltipText = `Limited to requests created between ${formatDate(minDate)} and ${formatDate(maxDate)}`;

  container.appendChild(createPill("date_range", formattedRange, tooltipText, tooltip, "period"));
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
 * Format date for display
 */
function formatDate(dateStr, short = false) {
  const options = {
    year: "numeric",
    month: short ? "short" : "long",
    day: "numeric",
  };

  return new Date(dateStr).toLocaleDateString("en-US", options);
}

/**
 * Get icon for dimension type
 */
function getDimensionTypeIcon(dataType) {
  const type = (dataType || "string").toLowerCase();

  if (type === "date") return "calendar_today";
  if (["point", "geo"].includes(type)) return "location_on";
  if (type === "string") return "abc";
  if (["integer", "number", "float"].includes(type)) return "tag";

  return "label";
}

/**
 * Get icon for measure type
 */
function getMeasureTypeIcon(dataType) {
  const type = (dataType || "number").toLowerCase();

  if (type === "integer") return "tag";
  if (["float", "number"].includes(type)) return "functions";
  if (type === "percentage") return "percent";

  return "functions";
}

/**
 * Get all dimensions from state
 */
function getStateDimensions() {
  const agg = state.aggregationDefinition || {};
  const dimensions = [];

  // Add all dimension types
  if (Array.isArray(agg.dimensions)) {
    dimensions.push(...agg.dimensions);
  }

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
  return Array.isArray(measures) ? measures.map((m) => m.alias).filter(Boolean) : [];
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
    const response = await fetch("../backend/assets/gemini_instructions/references/data_schema.json");

    if (response.ok) {
      dataSchemaCache = await response.json();
      return dataSchemaCache;
    }

    return EMPTY_SCHEMA;
  } catch (error) {
    console.warn("Error loading schema:", error.message);
    return EMPTY_SCHEMA;
  }
}
