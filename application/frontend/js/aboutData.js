/**
 * About Data Module
 * Displays metadata about the current visualization
 */
import { state } from "./state.js";
import { chartStyles } from "./chart/utils/chartStyles.js";

// Configuration
const TOOLTIP_WIDTH = "200px";
const EMPTY_SCHEMA = {
  dimensions: { time_dimension: [], geo_dimension: [], categorical_dimension: [] },
  measures: [],
};
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Cache for loaded schema
let dataSchemaCache = null;

/**
 * Main entry point - updates the About Data section
 */
export async function updateAboutData() {
  // Get and validate containers
  const containers = {
    attributes: document.querySelector(".viz-dimensions .dimension-tags"),
    measures: document.querySelector(".viz-metrics .metrics-tags"),
    filters: document.querySelector(".viz-filters .filter-tags"),
  };

  if (!Object.values(containers).every(Boolean)) {
    console.error("About Data containers not found");
    return;
  }

  // Clear and prepare
  Object.values(containers).forEach((container) => (container.innerHTML = ""));
  const schema = await loadDataSchema();
  const tooltip = chartStyles.createTooltip();

  // Update each section
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
    showEmptyMessage(container, "No attributes in this visualization");
    return;
  }

  dimensions.forEach((dimension) => {
    const info = findDimensionInSchema(dimension, schema);
    const iconName = getDimensionTypeIcon(info?.data_type);
    const label = info?.display_name || dimension;
    const description = info?.description_to_user || "Dimension attribute";

    container.appendChild(createPill(iconName, label, description, tooltip));
  });
}

/**
 * Update the Measures section
 */
function updateMeasuresSection(container, tooltip, schema) {
  const measures = getStateMeasures();

  if (!measures.length) {
    showEmptyMessage(container, "No measures in this visualization");
    return;
  }

  measures.forEach((measure) => {
    const info = findMeasureInSchema(measure, schema);
    const iconName = getMeasureTypeIcon(info?.data_type);
    const label = info?.display_name || measure;
    const description = info?.description_to_user || "Measure attribute";

    container.appendChild(createPill(iconName, label, description, tooltip));
  });
}

/**
 * Update the Filters section
 */
function updateFiltersSection(container, tooltip, schema) {
  // Add date range pill first
  const hasDatePill = addDateRangePill(container, tooltip);

  // Get filter data
  const filters = state.dataInsights?.filter_description || [];
  const preFilters = state.aggregationDefinition?.preAggregationFilters;
  const postFilters = state.aggregationDefinition?.postAggregationFilters;

  // Handle empty state
  if (!filters.length && !preFilters && !postFilters && !hasDatePill) {
    showEmptyMessage(container, "No filters applied");
    return;
  }

  // Add standard filters
  if (Array.isArray(filters) && filters.length > 0) {
    filters.forEach((filter) => {
      const fieldName = filter.filtered_field_name || filter.field || "Filter";
      const fieldInfo = findFieldInSchema(fieldName, schema);
      const label = fieldInfo?.display_name || fieldName;
      const description = filter.description || "Applied filter";

      container.appendChild(createPill("filter_alt", label, description, tooltip));
    });
  } else if (typeof filters === "string" && filters) {
    container.appendChild(createPill("filter_alt", "Filter", filters, tooltip));
  }
}

/**
 * Add date range pill to container
 * @returns {boolean} Whether a date pill was added
 */
function addDateRangePill(container, tooltip) {
  const dateRange = state.aggregationDefinition?.createdDateRange;
  if (!dateRange?.length || dateRange.length < 2) return false;

  const [minDate, maxDate] = dateRange;
  if (!minDate || !maxDate) return false;

  const formattedRange = `${formatDate(minDate, true)} - ${formatDate(maxDate, true)}`;
  const tooltipText = `Limited to requests created between ${formatDate(minDate)} and ${formatDate(maxDate)}`;

  container.appendChild(createPill("date_range", formattedRange, tooltipText, tooltip, "period", "Date Range"));

  return true;
}

/**
 * Create a pill element with tooltip
 */
function createPill(iconName, text, description, tooltip, extraClass = "", titleOverride = null) {
  const pill = document.createElement("div");
  pill.className = `tag-item ${extraClass}`;
  pill.innerHTML = `
    <span class="material-icons" style="font-size: 16px; margin-right: 4px;">${iconName}</span>
    <span>${text}</span>
  `;

  const tooltipTitle = titleOverride || text;
  const tooltipContent = `
    <strong>${tooltipTitle}</strong>
    ${description ? `<p>${description}</p>` : ""}
  `;

  // Add tooltip behavior
  addTooltipToPill(pill, tooltip, tooltipContent);

  return pill;
}

/**
 * Add tooltip behavior to a pill element
 */
function addTooltipToPill(pill, tooltip, content) {
  d3.select(pill)
    .on("mousemove", (event) => {
      chartStyles.tooltip.show(tooltip, event, content);
      styleTooltipForAboutData(tooltip);
    })
    .on("mouseleave", () => {
      resetTooltipStyle(tooltip);
      chartStyles.tooltip.hide(tooltip);
    });
}

/**
 * Apply About Data specific styling to tooltip
 */
function styleTooltipForAboutData(tooltip) {
  tooltip
    .classed("about-data-tooltip", true)
    .style("max-width", TOOLTIP_WIDTH)
    .style("width", "auto")
    .style("white-space", "normal");
}

/**
 * Reset tooltip styling
 */
function resetTooltipStyle(tooltip) {
  tooltip.classed("about-data-tooltip", false).style("max-width", null).style("width", null).style("white-space", null);
}

/**
 * Show empty message in container
 */
function showEmptyMessage(container, message) {
  container.innerHTML = `<span class='empty-message'>${message}</span>`;
}

/**
 * Format date string without timezone issues
 */
function formatDate(dateStr, short = false) {
  if (!dateStr || !dateStr.includes("-")) return dateStr;

  const [year, month, day] = dateStr.split("-").map((n) => parseInt(n, 10));
  const monthNames = short ? MONTHS_SHORT : MONTHS_LONG;

  return `${monthNames[month - 1]} ${day}, ${year}`;
}

/**
 * Get appropriate icon for dimension type
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
 * Get appropriate icon for measure type
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

  // Collect dimensions from all sources
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
  const measures = state.aggregationDefinition?.measures || [];
  return Array.isArray(measures) ? measures.map((m) => m.alias).filter(Boolean) : [];
}

/**
 * Find any field in schema
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
    const dimensions = schema.dimensions[type] || [];
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
  if (dataSchemaCache) return dataSchemaCache;

  try {
    const response = await fetch("../backend/assets/gemini_instructions/references/data_schema.json");

    if (response.ok) {
      dataSchemaCache = await response.json();
      return dataSchemaCache;
    }
  } catch (error) {
    console.warn("Error loading schema:", error.message);
  }

  return EMPTY_SCHEMA;
}
