/**
 * Table Component
 * Displays data in a tabular format with sorting and pagination
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import * as chartUtils from "./utils/chartUtils.js";

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

  const fields = Object.keys(state.dataset[0]);
  const measures = getMeasures();

  return fields.map((field) => {
    // Basic column config with translated display name
    const column = {
      name: chartUtils.getDisplayName(field), // Use display name from schema
      id: field,
    };

    // Add measure-specific formatting if applicable
    if (isMeasure(field, measures)) {
      // Only add right-alignment, no value formatting
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
 * Checks if a column contains numeric values
 * @param {Array} dataset - Dataset to analyze
 * @param {string} field - Field name to check
 * @returns {boolean} True if numeric
 */
function isNumericColumn(dataset, field) {
  const sampleSize = Math.min(10, dataset.length);
  let numericCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    const value = dataset[i][field];
    if (value !== null && value !== undefined && value !== "") {
      if (typeof value === "number" || !isNaN(parseFloat(value))) {
        numericCount++;
      }
    }
  }

  return numericCount / sampleSize >= 0.8;
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
      padding: 6px 8px;
      font-size: 12px;
    }
    
    /* Table headers */
    .viz-table-container .gridjs-th {
      padding: 6px 8px;
      font-size: 12px;
      font-weight: 500;
      background-color: var(--color-background, #f5f5f5);
    }
    
    /* Zebra striping */
    .viz-table-container .gridjs-tr:nth-child(even) td {
      background-color: #f9f9fc;
    }
    
    /* Pagination */
    .viz-table-container .gridjs-pagination {
      font-size: 12px;
      padding: 8px 0;
    }
    
    /* Pagination buttons */
    .viz-table-container .gridjs-pages button {
      padding: 4px 8px;
    }
  `;

  document.head.appendChild(styleEl);
}

export default renderTable;
