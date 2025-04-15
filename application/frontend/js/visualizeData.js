import { state } from "./state.js";
import renderTable from "./chart/table.js";
import renderBarChart from "./chart/single_bar_chart.js";
import renderLineChart from "./chart/line_chart.js";
import renderGroupedBarChart from "./chart/grouped_bar_chart.js";
import renderStackedBarChart from "./chart/stacked_bar_chart.js";
import renderStackedAreaChart from "./chart/stacked_area_chart.js";
import renderChoroplethMap from "./chart/choropleth_map.js";
import renderPointMap from "./chart/heat_map.js";
import renderTextResponse from "./chart/text_response.js";
import renderTreemap from "./chart/treemap.js";
import renderNestedBarChart from "./chart/nested_bar_chart.js";

/**
 * Cleans up previous visualizations.
 * @param {HTMLElement} container - The container element to clean
 */
function cleanupVisualization(container) {
  if (!container) return;

  // Clean up grid instance if it exists
  if (state.currentGridInstance) {
    state.currentGridInstance.destroy();
    state.currentGridInstance = null;
  }

  // Remove current chart if it exists
  if (state.currentChart && container.contains(state.currentChart)) {
    container.removeChild(state.currentChart);
    state.currentChart = null;
  }

  // Clear container contents
  container.innerHTML = "";
}

/**
 * Renders visualization if data is available
 * @param {HTMLElement} container - The container to render into
 * @param {Function} renderFunction - The chart rendering function
 */
function renderWithData(container, renderFunction) {
  if (state.dataset && state.dataset.length > 0) {
    renderFunction(container);
  } else {
    container.innerHTML = "<p>No data available to display.</p>";
  }
}

/**
 * Updates the data insights panel with content from the response
 * @param {Object} response - The API response containing insights
 */
function updateDataInsights(response) {
  const insightsContainer = document.getElementById("dataInsightsContainer");
  const insightsDiv = document.getElementById("dataInsights");

  // Clear existing content
  insightsDiv.innerHTML = "";

  // Create and add header content
  const headerContent = document.createElement("div");
  headerContent.className = "insight-header-content";

  // Add title if available
  if (response.dataInsights?.title) {
    const titleElement = document.createElement("h3");
    titleElement.className = "insight-title";
    titleElement.textContent = response.dataInsights.title;
    headerContent.appendChild(titleElement);
  }

  // Add description if available
  if (response.dataInsights?.dataDescription) {
    const descriptionElement = document.createElement("p");
    descriptionElement.className = "insight-description";
    descriptionElement.textContent = response.dataInsights.dataDescription;
    headerContent.appendChild(descriptionElement);
  }

  // Add header content to insights div
  insightsDiv.appendChild(headerContent);

  // Create chart container
  const tableContainer = document.createElement("div");
  tableContainer.id = "tableContainer";
  tableContainer.className = "chart-container";

  // Add chart container to insights div
  insightsDiv.appendChild(tableContainer);

  // Display the insights container with flex layout
  insightsContainer.style.display = "flex";
}

/**
 * Main function to render the appropriate chart based on chartType.
 */
export default function visualizeData() {
  // Update insights panel
  updateDataInsights(state);

  // Get and clean chart container
  const chartContainer = document.getElementById("tableContainer");
  cleanupVisualization(chartContainer);

  // Handle text responses differently
  if (state.chartType === "text") {
    renderTextResponse(chartContainer);
    return;
  }

  // Map chart types to their rendering functions
  const renderers = {
    table: renderTable,
    single_bar_chart: renderBarChart,
    grouped_bar_chart: renderGroupedBarChart,
    stacked_bar_chart: renderStackedBarChart,
    stacked_bar_chart_100: renderStackedBarChart,
    stacked_area_chart: renderStackedAreaChart,
    stacked_area_chart_100: renderStackedAreaChart,
    line_chart: renderLineChart,
    choropleth_map: renderChoroplethMap,
    heat_map: renderPointMap,
    treemap: renderTreemap,
    nested_bar_chart: renderNestedBarChart,
  };

  // Render the selected chart type if supported
  const renderer = renderers[state.chartType];
  if (renderer) {
    renderWithData(chartContainer, renderer);
  } else {
    chartContainer.innerHTML = `<p>Chart type "${state.chartType}" is not supported.</p>`;
  }
}
