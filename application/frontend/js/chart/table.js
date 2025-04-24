/**
 * Table Component
 * Displays data in a tabular format with sorting and pagination
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import * as chartUtils from "./utils/chartUtils.js";
import { formatFullNumber } from "./utils/chartUtils.js";

/**
 * Renders a data table visualization
 * @param {HTMLElement} container - DOM element to render the chart
 * @param {number} rowsPerPage - Number of rows to display per page
 */
function renderTable(container, rowsPerPage = 15) {
  // Validate input
  if (!container || !state.dataset?.length) {
    if (container) container.innerHTML = "<p>No data available to display</p>";
    return;
  }

  // Apply table styles
  injectTableStyles();

  // Clean up any existing instances
  if (state.currentGridInstance) {
    state.currentGridInstance.destroy();
  }

  // Create enhanced column configuration with proper alignment
  const columns = createColumnConfig();

  // Render grid
  state.currentGridInstance = new gridjs.Grid({
    columns: columns,
    data: state.dataset,
    pagination: {
      limit: rowsPerPage,
      summary: true,
    },
    className: {
      container: "viz-table-container",
    },
    sort: true,
    resizable: true,
  }).render(container);
}

/**
 * Creates column configuration with right alignment for numeric fields
 * @returns {Array} Column configuration
 */
function createColumnConfig() {
  if (!state.dataset?.length) return [];

  const fields = state.fields;
  const measures = getMeasures();

  return fields.map((field) => {
    // Basic column config with translated display name
    const column = {
      name: chartUtils.getDisplayName(field),
      id: field,
    };

    // Add measure-specific formatting if applicable
    if (isMeasure(field, measures)) {
      column.formatter = (cell) => formatFullNumber(cell, 2);

      column.attributes = (cell, row) => ({
        style: {
          "text-align": "right",
        },
      });
    }

    return column;
  });
}

/**
 * Determines if a field is a measure
 * @param {string} field - Field name to check
 * @param {Array} knownMeasures - Known measure fields
 * @returns {boolean} Is measure
 */
function isMeasure(field, knownMeasures) {
  if (knownMeasures.includes(field)) return true;

  // Detect numeric field by sampling data if not in known measures
  return isNumericColumn(state.dataset, field);
}

/**
 * Gets all measure fields from current state
 * @returns {Array} Measure field names
 */
function getMeasures() {
  // Get explicitly defined measures
  if (state.aggregationDefinition?.measures) {
    return state.aggregationDefinition.measures.map((m) => (typeof m === "string" ? m : m.alias || m.field));
  }
  return [];
}

/**
 * Checks if a column contains numeric values based on field metadata
 * @param {Array} dataset - Dataset (not used with metadata approach)
 * @param {string} field - Field name to check
 * @returns {boolean} True if the field is numeric
 */
function isNumericColumn(dataset, field) {
  // Get field metadata from state
  const fieldMetadata = state.aggregationDefinition?.fieldMetadata || [];

  // Find the metadata for this field
  const metadata = fieldMetadata.find((f) => f.physical_name === field);

  // Check if this field has a numeric data type
  if (metadata && metadata.data_type) {
    const dataType = metadata.data_type.toLowerCase();
    return dataType === "integer" || dataType === "float";
  }

  // If no metadata found or data_type is missing, assume non-numeric
  return false;
}

/**
 * Injects table-specific styles
 */
function injectTableStyles() {
  const styleId = "table-styles";
  if (document.getElementById(styleId)) return;

  const styleEl = document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = `
    /* Table container */
    .viz-table-container {
      font-family: ${chartStyles.fontFamily};
    }

    /* Table cells */
    .viz-table-container .gridjs-td {
      padding: 5px 5px;
      font-size: 12px;
    }
    
    /* Table headers */
    .viz-table-container .gridjs-th {
      padding: 5px 5px;
      font-size: 12px;
      font-weight: 500;
    }

    /* button */
    button.gridjs-sort {
      width: 10px;
    }
    
    /* Zebra striping */
    .viz-table-container .gridjs-tr:nth-child(even) td {
      background-color: #f9f9fc;
    }
    
    /* Pagination */
    .viz-table-container .gridjs-pagination {
      font-size: 12px;
      padding: 5px 0;
    }
    
    /* Pagination buttons */
    .viz-table-container .gridjs-pages button {
      padding: 5px 5px;
    }
  `;

  document.head.appendChild(styleEl);
}

export default renderTable;
