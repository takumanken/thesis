import { state } from "../state.js";

function renderTable(container) {
  // Apply table-specific styles
  injectTableStyles();
  const rowsPerPage = 15;

  const dataset = state.dataset;
  const fields = Object.keys(dataset[0]);

  // Clean up any existing instances
  if (state.currentGridInstance) {
    state.currentGridInstance.destroy();
  }

  state.currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: {
      limit: rowsPerPage,
      summary: true,
    },
    className: {
      container: "viz-table-container",
    },
  }).render(container);
}

// Inject styles directly
function injectTableStyles() {
  const styleId = "table-chart-styles";
  if (document.getElementById(styleId)) return;

  const styleEl = document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = `
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
      background-color: var(--color-background);
    }
    
    /* Zebra striping for rows */
    .viz-table-container .gridjs-tr:nth-child(even) td {
      background-color: #f9f9fc;
    }
    
    /* Pagination controls */
    .viz-table-container .gridjs-pagination {
      font-size: 12px;
      padding: 10px 0;
    }
    
    /* Pagination buttons */
    .viz-table-container .gridjs-pages button {
      padding: 6px 12px;
    }
  `;

  document.head.appendChild(styleEl);
}

export default renderTable;
