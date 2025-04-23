/**
 * About Data Module
 * Displays metadata (attributes, measures, filters) about the current visualization.
 */
import { state } from "./state.js";
import { chartStyles } from "./chart/utils/chartStyles.js";

// --- Configuration ---

const TOOLTIP_WIDTH = "200px";
const EMPTY_SCHEMA = {
  dimensions: { time_dimension: [], geo_dimension: [], categorical_dimension: [] },
  measures: [],
  data_sources: [],
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

// --- Main Update Function ---

/**
 * Updates the entire "About Data" section in the UI.
 */
export async function updateAboutData() {
  // Find all containers
  const containers = {
    attributes: document.querySelector(".viz-dimensions .dimension-tags"),
    measures: document.querySelector(".viz-metrics .metrics-tags"),
    filters: document.querySelector(".viz-filters .filter-tags"),
  };

  if (!Object.values(containers).every(Boolean)) {
    console.error("About Data UI containers not found.");
    return;
  }

  // Clear containers
  Object.values(containers).forEach((container) => (container.innerHTML = ""));

  // Get schema and create tooltip
  const schema = getSchema();
  const tooltip = chartStyles.createTooltip();

  // Update data source pills - add this line
  updateDataSourcePills();

  // Update sections using a more generic approach where possible
  updatePillSection(
    containers.attributes,
    tooltip,
    schema,
    getStateDimensions,
    findDimensionInSchema,
    getDimensionTypeIcon,
    "No attributes in this visualization"
  );

  updatePillSection(
    containers.measures,
    tooltip,
    schema,
    getStateMeasures,
    findMeasureInSchema,
    getMeasureTypeIcon,
    "No measures in this visualization"
  );

  // Filters section has more specific logic
  updateFiltersSection(containers.filters, tooltip, schema);
}

// --- Section Update Logic ---

/**
 * Generic function to update a section with pills (Attributes, Measures).
 * @param {HTMLElement} container - The container element for the pills.
 * @param {object} tooltip - The tippy tooltip instance.
 * @param {object} schema - The schema metadata object.
 * @param {function(): string[]} getItemsFn - Function to get the list of item names from state.
 * @param {function(string, object): object|null} findInfoFn - Function to find schema info for an item.
 * @param {function(string|null): string} getIconFn - Function to get the icon name for an item type.
 * @param {string} emptyMsg - Message to display if no items are found.
 */
function updatePillSection(container, tooltip, schema, getItemsFn, findInfoFn, getIconFn, emptyMsg) {
  const items = getItemsFn();

  if (!items.length) {
    showEmptyMessage(container, emptyMsg);
    return;
  }

  items.forEach((itemName) => {
    const info = findInfoFn(itemName, schema);
    const iconName = getIconFn(info?.data_type);
    const label = info?.display_name || itemName;
    const description = info?.description_to_user || `${itemName} attribute`; // Default description
    container.appendChild(createPill(iconName, label, description, tooltip, info, schema));
  });
}

/**
 * Updates the Filters section (more specific logic needed).
 */
function updateFiltersSection(container, tooltip, schema) {
  const hasDatePill = addDateRangePill(container, tooltip, schema);
  const filters = state.dataInsights?.filter_description || [];
  // Consider pre/post aggregation filters if they become structured similarly
  // const preFilters = state.aggregationDefinition?.preAggregationFilters;
  // const postFilters = state.aggregationDefinition?.postAggregationFilters;

  let hasOtherFilters = false;

  if (Array.isArray(filters) && filters.length > 0) {
    filters.forEach((filter) => {
      const fieldName = filter.filtered_field_name || filter.field || "Filter";
      const fieldInfo = findFieldInSchema(fieldName, schema); // Try finding info for filter field
      const label = fieldInfo?.display_name || fieldName;
      const description = filter.description || "Applied filter";
      container.appendChild(createPill("filter_alt", label, description, tooltip, fieldInfo, schema));
      hasOtherFilters = true;
    });
  } else if (typeof filters === "string" && filters) {
    // Handle simple string filter description
    container.appendChild(createPill("filter_alt", "Filter", filters, tooltip, null, schema));
    hasOtherFilters = true;
  }

  if (!hasDatePill && !hasOtherFilters) {
    showEmptyMessage(container, "No filters applied");
  }
}

/**
 * Adds the date range pill if applicable.
 * @returns {boolean} True if a date pill was added, false otherwise.
 */
function addDateRangePill(container, tooltip, schema) {
  const dateRange = state.aggregationDefinition?.createdDateRange;
  if (!dateRange?.length || dateRange.length < 2 || !dateRange[0] || !dateRange[1]) {
    return false;
  }

  const [minDate, maxDate] = dateRange;
  const formattedRange = `${formatDate(minDate, true)} - ${formatDate(maxDate, true)}`;
  const tooltipText = `Limited to requests created between ${formatDate(minDate)} and ${formatDate(maxDate)}`;
  const dateFieldInfo = findDimensionInSchema("created_date", schema); // Assume 'created_date' is the field

  container.appendChild(
    createPill("date_range", formattedRange, tooltipText, tooltip, dateFieldInfo, schema, "period", "Date Range")
  );
  return true;
}

// --- Pill & Tooltip Creation ---

/**
 * Creates a pill element with associated tooltip content.
 */
function createPill(iconName, text, description, tooltip, info, schema, extraClass = "", titleOverride = null) {
  const pill = document.createElement("div");
  pill.className = `tag-item ${extraClass}`;
  pill.innerHTML = `
    <span class="material-icons" style="font-size: 16px; margin-right: 4px;">${iconName}</span>
    <span>${text}</span>
  `;

  const tooltipTitle = titleOverride || text;
  const dataSourceLine = getDataSourceLine(info, schema);
  const descriptionPara = description ? `<p style="margin-top: 5px;">${description}</p>` : "";

  const tooltipContent = `
    <strong>${tooltipTitle}</strong><br>
    ${dataSourceLine}
    ${descriptionPara}
  `;

  addTooltipBehavior(pill, tooltip, tooltipContent);
  return pill;
}

/**
 * Generates the HTML string for the data source line in the tooltip.
 */
function getDataSourceLine(info, schema) {
  if (!info?.data_source_id || !schema?.data_sources) return "";

  const dataSource = schema.data_sources.find((ds) => ds.data_source_id === info.data_source_id);
  if (!dataSource?.data_source_short_name) return "";

  const databaseIconSvg = `<span class="material-symbols-outlined" style="font-size: 14px; padding-right: 4px">database</span>`;
  return `
    <span style="color: #888; font-size: 0.9em; display: inline-flex; align-items: center;">
      ${databaseIconSvg}
      ${dataSource.data_source_short_name}
    </span><br>`;
}

/**
 * Attaches mouse event listeners to a pill for showing/hiding the tooltip.
 */
function addTooltipBehavior(pill, tooltip, content) {
  d3.select(pill)
    .on("mousemove", (event) => {
      chartStyles.tooltip.show(tooltip, event, content);
      styleTooltipForAboutData(tooltip); // Apply specific styles
    })
    .on("mouseleave", () => {
      resetTooltipStyle(tooltip); // Reset styles
      chartStyles.tooltip.hide(tooltip);
    });
}

/** Applies specific CSS styles to the tooltip for this section. */
function styleTooltipForAboutData(tooltip) {
  tooltip
    .classed("about-data-tooltip", true)
    .style("max-width", TOOLTIP_WIDTH)
    .style("width", "auto")
    .style("white-space", "normal");
}

/** Resets tooltip styles to default. */
function resetTooltipStyle(tooltip) {
  tooltip.classed("about-data-tooltip", false).style("max-width", null).style("width", null).style("white-space", null);
}

// --- State & Schema Accessors ---

/** Gets schema from state or returns an empty fallback. */
function getSchema() {
  return state.schemaMetadata || EMPTY_SCHEMA;
}

/** Gets unique dimension names from the current aggregation definition. */
function getStateDimensions() {
  const agg = state.aggregationDefinition || {};
  const dimensions = new Set([
    ...(agg.dimensions || []),
    ...(agg.timeDimension || []),
    ...(agg.geoDimension || []),
    ...(agg.categoricalDimension || []),
  ]);
  return Array.from(dimensions);
}

/** Gets measure alias names from the current aggregation definition. */
function getStateMeasures() {
  const measures = state.aggregationDefinition?.measures || [];
  return Array.isArray(measures) ? measures.map((m) => m.alias).filter(Boolean) : [];
}

/** Finds schema info for any field (dimension or measure). */
function findFieldInSchema(fieldName, schema) {
  return findDimensionInSchema(fieldName, schema) || findMeasureInSchema(fieldName, schema);
}

/** Finds schema info for a dimension field. */
function findDimensionInSchema(dimensionName, schema) {
  if (!schema?.dimensions || !dimensionName) return null;
  for (const type of ["time_dimension", "geo_dimension", "categorical_dimension"]) {
    const found = (schema.dimensions[type] || []).find((dim) => dim.physical_name === dimensionName);
    if (found) return found;
  }
  return null;
}

/** Finds schema info for a measure field. */
function findMeasureInSchema(measureName, schema) {
  if (!schema?.measures || !measureName) return null;
  return schema.measures.find((m) => m.physical_name === measureName);
}

// --- Formatting & Utility Helpers ---

/** Shows a message within a container when there are no items. */
function showEmptyMessage(container, message) {
  container.innerHTML = `<span class='empty-message'>${message}</span>`;
}

/** Formats a YYYY-MM-DD date string. */
function formatDate(dateStr, short = false) {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  try {
    const [year, month, day] = dateStr.split("-").map((n) => parseInt(n, 10));
    const monthNames = short ? MONTHS_SHORT : MONTHS_LONG;
    return `${monthNames[month - 1]} ${day}, ${year}`;
  } catch (e) {
    console.error("Error formatting date:", dateStr, e);
    return dateStr; // Fallback to original string on error
  }
}

/** Gets the Material Icon name based on dimension data type. */
function getDimensionTypeIcon(dataType) {
  const type = (dataType || "string").toLowerCase();
  switch (type) {
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

/** Gets the Material Icon name based on measure data type. */
function getMeasureTypeIcon(dataType) {
  const type = (dataType || "number").toLowerCase();
  switch (type) {
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
 * Creates and updates data source pills displayed under the viz title
 */
export function updateDataSourcePills() {
  // Find the container where we'll add the data source pills
  const vizArea = document.querySelector(".visualization-area");
  const vizTitle = document.querySelector(".viz-title");

  if (!vizArea || !vizTitle) return;

  // Remove any existing data source pills
  const existingPills = document.querySelector(".data-source-pills");
  if (existingPills) existingPills.remove();

  // Don't show pills if there's no data
  if (!state.dataset || !state.dataset.length) return;

  // Create container for data source pills
  const container = document.createElement("div");
  container.className = "data-source-pills";

  // Add "Answered with:" label
  const label = document.createElement("span");
  label.className = "data-source-label";
  label.textContent = "Answered with:";
  container.appendChild(label);

  // Get data sources based on the current visualization
  const dataSources = getDataSourcesFromState();

  // Create tooltip instance
  const tooltip = chartStyles.createTooltip();

  // Create a pill for each data source
  dataSources.forEach((source) => {
    // Create pill container
    const pill = document.createElement("div");
    pill.className = "data-source-pill";

    // Add database icon and source name
    pill.innerHTML = `
      <span class="material-symbols-outlined">database</span>
      ${source.data_source_short_name || source.data_source_name}
    `;

    // Add tooltip behavior
    const tooltipContent = formatDataSourceTooltip(source);
    addTooltipBehavior(pill, tooltip, tooltipContent);

    const pillLink = document.createElement("a");
    pillLink.href = source.data_source_url;
    pillLink.target = "_blank";
    pillLink.rel = "noopener noreferrer";
    pillLink.appendChild(pill);
    container.appendChild(pillLink);
  });

  // Insert after the title using the title's parent
  const titleParent = vizTitle.parentNode;
  if (vizTitle.nextElementSibling) {
    titleParent.insertBefore(container, vizTitle.nextElementSibling);
  } else {
    titleParent.appendChild(container);
  }
}

/**
 * Format data source information for tooltip display
 */
function formatDataSourceTooltip(source) {
  if (!source) return "";

  const name = source.data_source_name
    ? `<div style="font-weight: bold; margin-bottom: 6px;">${source.data_source_name}</div>`
    : "";

  const description = source.description_to_user ? `<div>${source.description_to_user}</div>` : "";

  // URL is no longer displayed in tooltip
  return `${name}${description}`;
}

/**
 * Determine data sources based on fields used in visualization
 * @returns {Array} Array of data source objects
 */
function getDataSourcesFromState() {
  const schema = getSchema();
  if (!schema?.data_sources?.length) {
    // Return default with minimal information if no schema
    return [
      {
        data_source_short_name: "NYC Open Data - 311 Request",
        data_source_name: "NYC 311 Service Requests",
      },
    ];
  }

  // Get all dimensions and measures currently used
  const dimensions = getStateDimensions();
  const measures = getStateMeasures();

  // Track unique data sources by ID
  const dataSourcesById = new Map();

  // Process dimensions
  dimensions.forEach((dimensionName) => {
    const info = findDimensionInSchema(dimensionName, schema);
    if (info?.data_source_id) {
      dataSourcesById.set(info.data_source_id, true);
    }
  });

  // Process measures
  measures.forEach((measureName) => {
    const info = findMeasureInSchema(measureName, schema);
    if (info?.data_source_id) {
      dataSourcesById.set(info.data_source_id, true);
    }
  });

  // If we didn't find any data sources, return the default
  if (dataSourcesById.size === 0) {
    return [schema.data_sources[0]]; // Return first data source as default
  }

  // Get the full data source objects for all identified IDs
  const dataSources = [];
  dataSourcesById.forEach((_, sourceId) => {
    const source = schema.data_sources.find((ds) => ds.data_source_id === sourceId);
    if (source) {
      dataSources.push(source);
    }
  });

  return dataSources;
}
