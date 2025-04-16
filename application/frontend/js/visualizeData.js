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

// Modify updateDataInsights function to include chart type selector
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

  // Create chart type dropdown in the sidebar
  createChartTypeSwitcher();

  // Display the insights container with flex layout
  insightsContainer.style.display = "flex";
}

/**
 * Creates or updates the chart type dropdown in the sidebar
 */
function createChartTypeSwitcher() {
  // Find the chart controls container in the sidebar
  const chartControlsContainer = document.querySelector(".insight-sidebar .chart-controls-container");
  if (!chartControlsContainer) return;

  // Find the heading "Switch to other charts"
  const headings = chartControlsContainer.querySelectorAll("h3.controls-heading");
  let chartTypeSection;

  headings.forEach((heading) => {
    if (heading.textContent.includes("Switch to other charts")) {
      chartTypeSection = heading.parentElement;
    }
  });

  if (!chartTypeSection) return;

  // Check if dropdown already exists
  let chartTypeDropdown = chartTypeSection.querySelector("#chartTypeDropdown");

  // Create dropdown if it doesn't exist
  if (!chartTypeDropdown) {
    chartTypeDropdown = document.createElement("select");
    chartTypeDropdown.id = "chartTypeDropdown";
    chartTypeDropdown.className = "chart-type-dropdown";

    // Add event listener
    chartTypeDropdown.addEventListener("change", function (event) {
      state.chartType = event.target.value;
      visualizeData(); // Re-render with new chart type
    });

    // Add after the heading
    chartTypeSection.appendChild(chartTypeDropdown);
  }

  // Clear existing options
  chartTypeDropdown.innerHTML = "";

  // Add options based on available chart types
  const chartTypes = {
    table: "Data Table",
    single_bar_chart: "Bar Chart",
    grouped_bar_chart: "Grouped Bar Chart",
    stacked_bar_chart: "Stacked Bar Chart",
    stacked_bar_chart_100: "100% Stacked Bar Chart",
    stacked_area_chart: "Stacked Area Chart",
    stacked_area_chart_100: "100% Stacked Area Chart",
    line_chart: "Line Chart",
    choropleth_map: "Choropleth Map",
    heat_map: "Heat Map",
    treemap: "Treemap",
    nested_bar_chart: "Nested Bar Chart",
  };

  // Only show chart types that are available for this dataset
  state.availableChartTypes.forEach((chartType) => {
    if (chartType in chartTypes) {
      const option = document.createElement("option");
      option.value = chartType;
      option.textContent = chartTypes[chartType];
      option.selected = chartType === state.chartType;
      chartTypeDropdown.appendChild(option);
    }
  });
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
