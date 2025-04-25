/**
 * About Data Module
 * Displays metadata (attributes, measures, filters) about the current visualization.
 */
import { state } from "./state.js";
import { chartStyles } from "./chart/utils/chartStyles.js";

// --- Configuration ---

const TOOLTIP_WIDTH = "200px";
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
    period: document.querySelector(".viz-period .period-tags"),
    attributes: document.querySelector(".viz-dimensions .dimension-tags"),
    measures: document.querySelector(".viz-metrics .metrics-tags"),
    filters: document.querySelector(".viz-filters .filter-tags"),
  };

  // Create period section if it doesn't exist
  if (!containers.period) {
    const periodSection = document.createElement("div");
    periodSection.className = "viz-period";

    const periodTitle = document.createElement("h4");
    periodTitle.className = "control-section-title";
    periodTitle.textContent = "Period";

    const periodTags = document.createElement("div");
    periodTags.className = "period-tags";

    periodSection.appendChild(periodTitle);
    periodSection.appendChild(periodTags);

    // Insert at the beginning of the viz-definition section
    const vizDefinition = document.querySelector(".viz-definition");
    const attributesSection = document.querySelector(".viz-dimensions");
    if (vizDefinition && attributesSection) {
      vizDefinition.insertBefore(periodSection, attributesSection);
      containers.period = periodTags;
    }
  }

  if (!Object.values(containers).every(Boolean)) {
    console.error("About Data UI containers not found.");
    return;
  }

  // Clear containers
  Object.values(containers).forEach((container) => (container.innerHTML = ""));

  // Get field metadata
  const fieldMetadata = state.aggregationDefinition?.fieldMetadata || [];

  // Create tooltip
  const tooltip = chartStyles.createTooltip();

  // Update data source pills
  updateDataSourcePills();

  // Add date range to period section (not to filters anymore)
  addDateRangeToPeriodSection(containers.period, tooltip, fieldMetadata);

  // Update other sections using field metadata
  updatePillSection(
    containers.attributes,
    tooltip,
    getStateDimensions(),
    fieldMetadata,
    getDimensionTypeIcon,
    "No attributes in this visualization"
  );

  updatePillSection(
    containers.measures,
    tooltip,
    getStateMeasures(),
    fieldMetadata,
    getMeasureTypeIcon,
    "No measures in this visualization"
  );

  // Filters section (now without date range)
  updateFiltersWithoutDateRange(containers.filters, tooltip, fieldMetadata);
}

// --- Section Update Logic ---

/**
 * Generic function to update a section with pills (Attributes, Measures).
 * @param {HTMLElement} container - The container element for the pills
 * @param {object} tooltip - The tippy tooltip instance
 * @param {string[]} items - Array of field names to display
 * @param {Array} fieldMetadata - Array of field metadata objects
 * @param {function(string|null): string} getIconFn - Function to get the icon name for field type
 * @param {string} emptyMsg - Message to display if no items are found
 */
function updatePillSection(container, tooltip, items, fieldMetadata, getIconFn, emptyMsg) {
  if (!items.length) {
    showEmptyMessage(container, emptyMsg);
    return;
  }

  items.forEach((itemName) => {
    const info = findFieldMetadata(itemName, fieldMetadata);
    const iconName = getIconFn(info?.data_type);
    const label = info?.display_name || itemName;
    const description = info?.description_to_user || `${itemName} attribute`;
    container.appendChild(createPill(iconName, label, description, tooltip, info));
  });
}

/**
 * Adds the date range pill to the period section if applicable
 * @returns {boolean} True if a date pill was added, false otherwise
 */
function addDateRangeToPeriodSection(container, tooltip, fieldMetadata) {
  const dateRange = state.aggregationDefinition?.createdDateRange;
  if (!dateRange?.length || dateRange.length < 2 || !dateRange[0] || !dateRange[1]) {
    container.innerHTML = `<span class='empty-message'>No time period specified</span>`;
    return false;
  }

  const [minDate, maxDate] = dateRange;
  const formattedRange = `${formatDate(minDate, true)} - ${formatDate(maxDate, true)}`;
  const tooltipText = `Data covers requests created between ${formatDate(minDate)} and ${formatDate(maxDate)}`;
  const dateFieldInfo = findFieldMetadata("created_date", fieldMetadata);

  // Create date pill with special "date-period" class for custom styling
  container.appendChild(
    createPill("date_range", formattedRange, tooltipText, tooltip, dateFieldInfo, "date-period", "Date Range")
  );
  return true;
}

/**
 * Updates the Filters section without date range pill
 */
function updateFiltersWithoutDateRange(container, tooltip, fieldMetadata) {
  const filters = state.dataInsights?.filter_description || [];
  let hasFilters = false;

  if (Array.isArray(filters) && filters.length > 0) {
    filters.forEach((filter) => {
      const fieldName = filter.filtered_field_name || filter.field || "Filter";
      const fieldInfo = findFieldMetadata(fieldName, fieldMetadata);
      const label = fieldInfo?.display_name || fieldName;
      const description = filter.description || "Applied filter";
      container.appendChild(createPill("filter_alt", label, description, tooltip, fieldInfo));
      hasFilters = true;
    });
  } else if (typeof filters === "string" && filters) {
    // Handle simple string filter description
    container.appendChild(createPill("filter_alt", "Filter", filters, tooltip, null));
    hasFilters = true;
  }

  if (!hasFilters) {
    showEmptyMessage(container, "No filters applied");
  }
}

// --- Pill & Tooltip Creation ---

/**
 * Creates a pill element with associated tooltip content
 */
function createPill(iconName, text, description, tooltip, info, extraClass = "", titleOverride = null) {
  const pill = document.createElement("div");
  pill.className = `tag-item ${extraClass}`;
  pill.innerHTML = `
    <span class="material-icons" style="font-size: 16px; margin-right: 4px;">${iconName}</span>
    <span>${text}</span>
  `;

  const tooltipTitle = titleOverride || text;
  const dataSourceLine = getDataSourceLine(info);
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
 * Generates the HTML string for the data source line in the tooltip
 */
function getDataSourceLine(info) {
  if (!info?.data_source_id) return "";

  const dataSourceMetadata = state.aggregationDefinition?.datasourceMetadata || [];
  const dataSource = dataSourceMetadata.find((ds) => ds.data_source_id === info.data_source_id);

  if (!dataSource?.data_source_short_name) return "";

  const databaseIconSvg = `<span class="material-symbols-outlined" style="font-size: 14px; padding-right: 4px">database</span>`;
  return `
    <span style="color: #888; font-size: 0.9em; display: inline-flex; align-items: center;">
      ${databaseIconSvg}
      ${dataSource.data_source_short_name}
    </span><br>`;
}

/**
 * Attaches mouse event listeners to a pill for showing/hiding the tooltip
 */
function addTooltipBehavior(pill, tooltip, content) {
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

/** Applies specific CSS styles to the tooltip for this section */
function styleTooltipForAboutData(tooltip) {
  tooltip
    .classed("about-data-tooltip", true)
    .style("max-width", TOOLTIP_WIDTH)
    .style("width", "auto")
    .style("white-space", "normal");
}

/** Resets tooltip styles to default */
function resetTooltipStyle(tooltip) {
  tooltip.classed("about-data-tooltip", false).style("max-width", null).style("width", null).style("white-space", null);
}

// --- State & Metadata Accessors ---

/** Gets unique dimension names from the current aggregation definition */
function getStateDimensions() {
  const dimensions = state.aggregationDefinition?.dimensions || [];
  return Array.from(dimensions);
}

/** Gets measure alias names from the current aggregation definition */
function getStateMeasures() {
  const measures = state.aggregationDefinition?.measures || [];
  return Array.isArray(measures) ? measures.map((m) => m.alias).filter(Boolean) : [];
}

/** Finds field metadata by physical name */
function findFieldMetadata(fieldName, fieldMetadata) {
  if (!fieldMetadata || !fieldName) return null;
  return fieldMetadata.find((field) => field.physical_name === fieldName);
}

// --- Formatting & Utility Helpers ---

/** Shows a message within a container when there are no items */
function showEmptyMessage(container, message) {
  container.innerHTML = `<span class='empty-message'>${message}</span>`;
}

/** Formats a YYYY-MM-DD date string */
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

/** Gets the Material Icon name based on dimension data type */
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

/** Gets the Material Icon name based on measure data type */
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

  // Get data sources directly from state metadata
  const dataSources = state.aggregationDefinition?.datasourceMetadata || [];

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

  return `${name}${description}`;
}
