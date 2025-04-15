import { state } from "./state.js";
import renderTable from "./chart/table.js";
import renderBarChart from "./chart/single_bar_chart.js";
import renderLineChart from "./chart/line_chart.js";
import renderGroupedBarChart from "./chart/grouped_bar_chart.js";
import renderStackedBarChart from "./chart/stacked_bar_chart.js";
import renderStackedAreaChart from "./chart/stacked_area_chart.js"; // Import new chart type
import renderChoroplethMap from "./chart/choropleth_map.js";
import renderPointMap from "./chart/heat_map.js";
import renderTextResponse from "./chart/text_response.js";
import renderTreemap from "./chart/treemap.js";
import renderNestedBarChart from "./chart/nested_bar_chart.js";

// Clean up previous visualizations.
function cleanupVisualization(container) {
  if (!container) return; // Guard against null containers

  if (state.currentGridInstance) {
    state.currentGridInstance.destroy();
    state.currentGridInstance = null;
  }

  if (state.currentChart) {
    if (container.contains(state.currentChart)) {
      container.removeChild(state.currentChart);
    }
    state.currentChart = null;
  }

  // Clear contents but don't remove the container itself
  container.innerHTML = "";
}

// Helper function to safely render data visualizations
function renderWithData(container, renderFunction) {
  if (state.dataset && state.dataset.length > 0) {
    renderFunction(container);
  } else {
    container.innerHTML = "<p>No data available to display.</p>";
  }
}

// Update the updateDataInsights function for better performance
function updateDataInsights(response) {
  const insightsContainer = document.getElementById("dataInsightsContainer");
  const insightsDiv = document.getElementById("dataInsights");

  // More efficient DOM manipulation - clear once instead of in a loop
  // Keep a reference to the tableContainer
  const tableContainer = document.getElementById("tableContainer");

  // Clear content in one operation
  insightsDiv.innerHTML = "";

  // Create header content
  const headerContent = document.createElement("div");
  headerContent.className = "insight-header-content";

  // Add title if available
  if (response.dataInsights && response.dataInsights.title) {
    const titleElement = document.createElement("h3");
    titleElement.className = "insight-title";
    titleElement.textContent = response.dataInsights.title;
    headerContent.appendChild(titleElement);
  }

  // Add description if available
  if (response.dataInsights && response.dataInsights.dataDescription) {
    const descriptionElement = document.createElement("p");
    descriptionElement.className = "insight-description";
    descriptionElement.textContent = response.dataInsights.dataDescription;
    headerContent.appendChild(descriptionElement);
  }

  // Build DOM tree before inserting
  insightsDiv.appendChild(headerContent);

  // Re-add or create tableContainer
  let newTableContainer;
  if (tableContainer) {
    // Clear the container but preserve its ID and class
    newTableContainer = tableContainer.cloneNode(false);
  } else {
    newTableContainer = document.createElement("div");
    newTableContainer.id = "tableContainer";
    newTableContainer.className = "chart-container";
  }

  insightsDiv.appendChild(newTableContainer);

  // Display the container - use flex instead of grid for better performance
  insightsContainer.style.display = "block";
}

// Main function to render chart based on chartType.
export default function visualizeData() {
  updateDataInsights(state);
  const chartContainer = document.getElementById("tableContainer");
  cleanupVisualization(chartContainer);

  if (state.chartType === "text") {
    renderTextResponse(chartContainer);
    return;
  }

  // For all data-dependent charts, use the helper function
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

  const renderer = renderers[state.chartType];
  if (renderer) {
    renderWithData(chartContainer, renderer);
  } else {
    chartContainer.innerHTML = `<p>Chart type "${state.chartType}" is not supported.</p>`;
  }
}
