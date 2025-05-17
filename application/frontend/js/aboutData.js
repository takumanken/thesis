import { state } from "./state.js";
import { chartStyles } from "./chart/utils/chartStyles.js";

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

export async function updateAboutData() {
  const containers = {
    period: document.querySelector(".viz-period .period-tags"),
    attributes: document.querySelector(".viz-dimensions .dimension-tags"),
    measures: document.querySelector(".viz-metrics .metrics-tags"),
    filters: document.querySelector(".viz-filters .filter-tags"),
  };

  if (!Object.values(containers).every(Boolean)) {
    console.error("About Data UI containers not found.");
    return;
  }

  // Clear all containers
  Object.values(containers).forEach((container) => (container.innerHTML = ""));

  const fieldMetadata = state.aggregationDefinition?.fieldMetadata || [];
  const tooltip = chartStyles.createTooltip();

  updateDataSourcePills();
  addDateRangeToPeriodSection(containers.period, tooltip, fieldMetadata);

  const dimensions = Array.from(state.aggregationDefinition?.dimensions || []);
  updatePillSection(
    containers.attributes,
    tooltip,
    dimensions,
    fieldMetadata,
    getDimensionTypeIcon,
    "No attributes in this visualization"
  );

  const measures = state.aggregationDefinition?.measures || [];
  const measureAliases = Array.isArray(measures) ? measures.map((m) => m.alias).filter(Boolean) : [];
  updatePillSection(
    containers.measures,
    tooltip,
    measureAliases,
    fieldMetadata,
    () => "functions",
    "No measures in this visualization"
  );

  updateFiltersWithoutDateRange(containers.filters, tooltip, fieldMetadata);
}

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

function addDateRangeToPeriodSection(container, tooltip, fieldMetadata) {
  const dateRange = state.aggregationDefinition?.createdDateRange;
  if (!dateRange?.length || dateRange.length < 2 || !dateRange[0] || !dateRange[1]) {
    container.innerHTML = "<span class='empty-message'>No time period specified</span>";
    return false;
  }

  const [minDate, maxDate] = dateRange;
  const formattedRange = `${formatDate(minDate, true)} - ${formatDate(maxDate, true)}`;
  const tooltipText = `Data covers requests created between ${formatDate(minDate)} and ${formatDate(maxDate)}`;
  const dateFieldInfo = findFieldMetadata("created_date", fieldMetadata);

  container.appendChild(
    createPill("date_range", formattedRange, tooltipText, tooltip, dateFieldInfo, "date-period", "Date Range")
  );
  return true;
}

function updateFiltersWithoutDateRange(container, tooltip, fieldMetadata) {
  const filters = state.dataInsights?.filterDescription || [];
  let hasFilters = false;

  if (Array.isArray(filters) && filters.length > 0) {
    filters.forEach((filter) => {
      const fieldName = filter.filteredFieldName || filter.field || "Filter";
      const fieldInfo = findFieldMetadata(fieldName, fieldMetadata);
      const label = fieldInfo?.display_name || fieldName;
      const description = filter.description || "Applied filter";
      container.appendChild(createPill("filter_alt", label, description, tooltip, fieldInfo));
      hasFilters = true;
    });
  } else if (typeof filters === "string" && filters) {
    container.appendChild(createPill("filter_alt", "Filter", filters, tooltip, null));
    hasFilters = true;
  }

  if (!hasFilters) {
    showEmptyMessage(container, "No filters applied");
  }
}

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

function getDataSourceLine(info) {
  if (!info?.data_source_id) return "";

  const dataSourceMetadata = state.aggregationDefinition?.datasourceMetadata || [];
  const dataSource = dataSourceMetadata.find((ds) => ds.data_source_id === info.data_source_id);

  if (!dataSource?.data_source_short_name) return "";

  return `
    <span style="color: #888; font-size: 0.9em; display: inline-flex; align-items: center;">
      <span class="material-symbols-outlined" style="font-size: 14px; padding-right: 4px">database</span>
      ${dataSource.data_source_short_name}
    </span><br>`;
}

function addTooltipBehavior(pill, tooltip, content) {
  d3.select(pill)
    .on("mousemove", (event) => {
      chartStyles.tooltip.show(tooltip, event, content);
      tooltip
        .classed("about-data-tooltip", true)
        .style("max-width", TOOLTIP_WIDTH)
        .style("width", "auto")
        .style("white-space", "normal");
    })
    .on("mouseleave", () => {
      tooltip
        .classed("about-data-tooltip", false)
        .style("max-width", null)
        .style("width", null)
        .style("white-space", null);
      chartStyles.tooltip.hide(tooltip);
    });
}

function findFieldMetadata(fieldName, fieldMetadata) {
  if (!fieldMetadata || !fieldName) return null;
  return fieldMetadata.find((field) => field.physical_name === fieldName);
}

function showEmptyMessage(container, message) {
  container.innerHTML = `<span class='empty-message'>${message}</span>`;
}

function formatDate(dateStr, short = false) {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  try {
    const [year, month, day] = dateStr.split("-").map((n) => parseInt(n, 10));
    const monthNames = short ? MONTHS_SHORT : MONTHS_LONG;
    return `${monthNames[month - 1]} ${day}, ${year}`;
  } catch (e) {
    console.error("Error formatting date:", dateStr, e);
    return dateStr;
  }
}

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

export function updateDataSourcePills() {
  const vizTitle = document.querySelector(".viz-title");
  if (!vizTitle) return;

  const existingPills = document.querySelector(".data-source-pills");
  if (existingPills) existingPills.remove();

  if (!state.dataset || !state.dataset.length) return;

  const container = document.createElement("div");
  container.className = "data-source-pills";

  const label = document.createElement("span");
  label.className = "data-source-label";
  label.textContent = "Answered with:";
  container.appendChild(label);

  const dataSources = state.aggregationDefinition?.datasourceMetadata || [];
  const tooltip = chartStyles.createTooltip();

  dataSources.forEach((source) => {
    const pill = document.createElement("div");
    pill.className = "data-source-pill";
    pill.innerHTML = `
      <span class="material-symbols-outlined">database</span>
      ${source.data_source_short_name || source.data_source_name}
    `;

    const tooltipContent = !source
      ? ""
      : `
      ${
        source.data_source_name
          ? `<div style="font-weight: bold; margin-bottom: 6px;">${source.data_source_name}</div>`
          : ""
      }
      ${source.description_to_user ? `<div>${source.description_to_user}</div>` : ""}
    `;

    addTooltipBehavior(pill, tooltip, tooltipContent);

    const pillLink = document.createElement("a");
    pillLink.href = source.data_source_url;
    pillLink.target = "_blank";
    pillLink.rel = "noopener noreferrer";
    pillLink.appendChild(pill);
    container.appendChild(pillLink);
  });

  const titleParent = vizTitle.parentNode;
  if (vizTitle.nextElementSibling) {
    titleParent.insertBefore(container, vizTitle.nextElementSibling);
  } else {
    titleParent.appendChild(container);
  }
}
