import { state } from "./state.js";
import { chartControls } from "./chart/utils/chartControls.js"; // Add this import
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
/**
 * Updates the data insights panel with chart information
 * @param {Object} response - The data response containing insights
 */
function updateDataInsights(response) {
  // Find containers with fallbacks for different possible IDs/classes
  const insightsContainer =
    document.getElementById("dataInsightsContainer") ||
    document.querySelector(".dashboard-panel") ||
    document.querySelector(".insight-container");

  // Look for the visualization area with multiple possible selectors
  const insightsDiv =
    document.getElementById("dataInsights") ||
    document.querySelector(".visualization-area") ||
    document.querySelector(".insight-content");

  // If we couldn't find the containers, log an error and stop
  if (!insightsContainer || !insightsDiv) {
    console.error("Visualization containers not found. Check HTML structure.", {
      insightsContainer,
      insightsDiv,
    });
    return;
  }

  // Clear existing content
  insightsDiv.innerHTML = "";

  // Create and add header content
  const headerContent = document.createElement("div");
  headerContent.className = "insight-header-content";

  // Add title if available
  if (response.dataInsights?.title) {
    const titleElement = document.createElement("h3");
    titleElement.className = "viz-title";
    titleElement.textContent = response.dataInsights.title;
    headerContent.appendChild(titleElement);
  }

  // Add description if available
  if (response.dataInsights?.dataDescription) {
    const descriptionElement = document.createElement("p");
    descriptionElement.className = "viz-description";
    descriptionElement.textContent = response.dataInsights.dataDescription;
    headerContent.appendChild(descriptionElement);
  }

  // Add header content to insights div
  insightsDiv.appendChild(headerContent);

  // Create chart container with both possible IDs for compatibility
  const vizContainer = document.createElement("div");
  vizContainer.id = "vizContainer";
  vizContainer.className = "viz-container";

  // Add chart container to insights div
  insightsDiv.appendChild(vizContainer);

  // Create chart type dropdown in the sidebar
  createChartTypeSwitcher();

  // Display the insights container
  insightsContainer.style.display = "flex";
}

/**
 * Creates and populates the chart type switcher with available chart types
 */
function createChartTypeSwitcher() {
  // Find the selector container
  const selectorContainer = document.querySelector(".viz-type-selector");
  if (!selectorContainer) {
    console.error("Chart type selector container not found");
    return;
  }

  // Clear existing content
  selectorContainer.innerHTML = "";

  // Chart type configuration map with icons and labels
  const chartTypeConfig = {
    table: { icon: "table_chart", label: "Table" },
    single_bar_chart: { icon: "bar_chart", label: "Bar Chart" },
    line_chart: { icon: "show_chart", label: "Line Chart" },
    choropleth_map: { icon: "map", label: "Map" },
    heat_map: { icon: "grain", label: "Heat Map" },
    grouped_bar_chart: { icon: "view_column", label: "Grouped Bar Chart" },
    stacked_bar_chart: { icon: "stacked_bar_chart", label: "Stacked Bar Chart" },
    stacked_bar_chart_100: { icon: "stacked_bar_chart", label: "100% Stacked Bar" },
    stacked_area_chart: { icon: "area_chart", label: "Area Chart" },
    stacked_area_chart_100: { icon: "area_chart", label: "100% Area Chart" },
    treemap: { icon: "grid_view", label: "Treemap" },
    nested_bar_chart: { icon: "view_list", label: "Nested Bar Chart" },
  };

  // Use state.availableChartTypes if available, otherwise fallback to basic types
  const availableChartTypes = state.availableChartTypes || ["table"];

  console.log("Available chart types:", availableChartTypes);

  // Create chart type options for each available chart type
  availableChartTypes.forEach((typeId) => {
    // Get config or use fallback
    const config = chartTypeConfig[typeId] || {
      icon: "help_outline",
      label: typeId
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    };

    const option = document.createElement("div");
    option.className = `chart-type-option${state.chartType === typeId ? " selected" : ""}`;
    option.dataset.chartType = typeId;
    option.innerHTML = `<span class="material-icons">${config.icon}</span>`;
    option.title = config.label;

    // Add click handler
    option.addEventListener("click", function () {
      // Update selection state
      selectorContainer.querySelectorAll(".chart-type-option").forEach((opt) => {
        opt.classList.remove("selected");
      });
      this.classList.add("selected");

      // Store in state directly
      state.chartType = typeId;

      // Redraw visualization
      visualizeData();
    });

    selectorContainer.appendChild(option);
  });
}

/**
 * Switch to a different chart type
 * @param {string} chartType - The type of chart to switch to
 */
function switchChartType(chartType) {
  console.log(`Switching to chart type: ${chartType}`);

  // Update state directly
  state.chartType = chartType;

  // Redraw visualization using main function
  visualizeData();
}

// Make sure functions are globally available
window.createChartTypeSwitcher = createChartTypeSwitcher;
window.switchChartType = switchChartType;

/**
 * Renders the appropriate chart based on state
 */
function visualizeData() {
  // Update insights panel if needed
  updateDataInsights(state);

  // Reset dimension swap state when visualizing new data
  state.dimensionsSwapped = false;
  chartControls.removeExistingControl();

  // Get chart container with multiple fallbacks
  const chartContainer =
    document.getElementById("tableContainer") ||
    document.querySelector(".viz-container") ||
    document.querySelector("#viz-container");

  // Check if container exists before proceeding
  if (!chartContainer) {
    console.error("Chart container not found. Check your HTML structure.");
    return;
  }

  // Clean up any existing charts
  cleanupVisualization(chartContainer);

  // Get the current chart type
  const chartType = state.chartType || "single_bar_chart";

  console.log(`Rendering chart type: ${chartType}`);

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

  // Render the selected chart type
  try {
    const renderer = renderers[chartType];
    if (renderer) {
      renderer(chartContainer);
    } else {
      chartContainer.innerHTML = `<p>Chart type "${chartType}" is not supported.</p>`;
    }
  } catch (error) {
    console.error("Error rendering chart:", error);
    chartContainer.innerHTML = `<p>Error rendering chart: ${error.message}</p>`;
  }
}

export default visualizeData;
