import { state } from "./state.js";

let currentGridInstance = null;
let currentChart = null;

// ------------------------------
// Main Function
// ------------------------------

function visualizeData() {
  const { dataset, chartType } = state;
  const container = document.getElementById("tableContainer");
  document.getElementById("chartTypeSelector").value = state.chartType || "table";

  // Clean up previous visualizations
  cleanupVisualization(container);

  // Render based on selected chart type
  switch (chartType) {
    case "table":
      renderTable(dataset, container);
      break;
    case "bar_chart":
      renderBarChart(dataset, container);
      break;
    case "line_chart":
      renderLineChart(dataset, container);
      break;
    default:
      container.innerHTML = `<p>Chart type "${chartType}" is not supported.</p>`;
  }
}

export default visualizeData;

// -----------------------------
// Helper Functions
// -----------------------------

// Function to clean up previous visualizations
function cleanupVisualization(container) {
  // Clean up grid instance if it exists
  if (currentGridInstance) {
    currentGridInstance.destroy();
    currentGridInstance = null;
  }

  // Clean up chart if it exists
  if (currentChart) {
    container.removeChild(currentChart);
    currentChart = null;
  }

  // Clear any other content
  container.innerHTML = "";
}

// Function to render a table using gridjs
function renderTable(dataset, container) {
  const fields = Object.keys(dataset[0]);
  currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: { limit: 50 },
  }).render(container);
}

// Function to render a bar chart
function renderBarChart(dataset, container) {
  container.innerHTML = "<p>Loading bar chart...</p>";

  container.innerHTML =
    "<p>Bar chart visualization would appear here.</p>" +
    "<pre>" +
    JSON.stringify(dataset.slice(0, 3), null, 2) +
    "...</pre>";
}

// Function to render a line chart
function renderLineChart(dataset, container) {
  container.innerHTML = "<p>Loading line chart...</p>";

  container.innerHTML =
    "<p>Line chart visualization would appear here.</p>" +
    "<pre>" +
    JSON.stringify(dataset.slice(0, 3), null, 2) +
    "...</pre>";
}
