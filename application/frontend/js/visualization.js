/**
 * Data Visualization Module
 * Handles rendering of charts and visualizations based on state
 */
import { state } from "./state.js";
import { chartControls } from "./chart/utils/chartControls.js";
import { chartStyles } from "./chart/utils/chartStyles.js";
import { cleanupOrphanedTooltips } from "./chart/utils/chartUtils.js";
import { updateaboutData } from "./aboutData.js";

// Import chart renderers
import renderTable from "./chart/table.js";
import renderBarChart from "./chart/single_bar_chart.js";
import renderLineChart from "./chart/line_chart.js";
import renderGroupedBarChart from "./chart/grouped_bar_chart.js";
import renderStackedBarChart from "./chart/stacked_bar_chart.js";
import renderStackedAreaChart from "./chart/stacked_area_chart.js";
import renderChoroplethMap from "./chart/choropleth_map.js";
import renderPointMap from "./chart/heatmap.js";
import renderTextResponse from "./chart/text_response.js";
import renderTreemap from "./chart/treemap.js";
import renderNestedBarChart from "./chart/nested_bar_chart.js";

// Chart type configuration with icons and labels
const CHART_TYPE_CONFIG = {
  table: { icon: "table_chart", label: "Table" },
  single_bar_chart: { icon: "bar_chart", label: "Bar Chart" },
  line_chart: { icon: "show_chart", label: "Line Chart" },
  choropleth_map: { icon: "map", label: "Map" },
  heatmap: { icon: "grain", label: "Heat Map" },
  grouped_bar_chart: { icon: "view_column", label: "Grouped Bar Chart" },
  stacked_bar_chart: { icon: "stacked_bar_chart", label: "Stacked Bar Chart" },
  stacked_bar_chart_100: { icon: "stacked_bar_chart", label: "100% Stacked Bar" },
  stacked_area_chart: { icon: "area_chart", label: "Area Chart" },
  stacked_area_chart_100: { icon: "area_chart", label: "100% Area Chart" },
  treemap: { icon: "grid_view", label: "Treemap" },
  nested_bar_chart: { icon: "view_list", label: "Nested Bar Chart" },
  text: { icon: "text_fields", label: "Text Response" },
};

// Map of chart rendering functions
const CHART_RENDERERS = {
  table: renderTable,
  single_bar_chart: renderBarChart,
  grouped_bar_chart: renderGroupedBarChart,
  stacked_bar_chart: renderStackedBarChart,
  stacked_bar_chart_100: renderStackedBarChart,
  stacked_area_chart: renderStackedAreaChart,
  stacked_area_chart_100: renderStackedAreaChart,
  line_chart: renderLineChart,
  choropleth_map: renderChoroplethMap,
  heatmap: renderPointMap,
  treemap: renderTreemap,
  nested_bar_chart: renderNestedBarChart,
  text: renderTextResponse,
};

/**
 * Main visualization function - renders the appropriate chart based on state
 */
function visualization() {
  // Find and prepare containers
  const containers = findContainers();
  if (!containers) return;

  // Reset UI state for new visualization
  resetUiState();

  // Prepare visualization container
  setupVisualizationContainer(containers.insightsDiv, containers.insightsContainer);

  // Update the About Data section
  updateaboutData();

  // Render the selected chart
  renderChart();
}

/**
 * Find all necessary containers with fallbacks
 * @returns {Object|null} Container references or null if not found
 */
function findContainers() {
  const insightsContainer =
    document.getElementById("dataInsightsContainer") ||
    document.querySelector(".dashboard-panel") ||
    document.querySelector(".insight-container");

  const insightsDiv =
    document.getElementById("dataInsights") ||
    document.querySelector(".visualization-area") ||
    document.querySelector(".insight-content");

  if (!insightsContainer || !insightsDiv) {
    console.error("Visualization containers not found. Check HTML structure.");
    return null;
  }

  return { insightsContainer, insightsDiv };
}

/**
 * Reset UI state before rendering new visualization
 */
function resetUiState() {
  state.dimensionsSwapped = false;
  chartControls.removeExistingControl();
}

/**
 * Set up the visualization container with header and chart area
 * @param {HTMLElement} insightsDiv - The insights div container
 * @param {HTMLElement} insightsContainer - The outer insights container
 */
function setupVisualizationContainer(insightsDiv, insightsContainer) {
  // Clear existing content
  insightsDiv.innerHTML = "";

  // Add header content
  const headerContent = createHeaderContent();
  insightsDiv.appendChild(headerContent);

  // Create and add chart container
  const vizContainer = document.createElement("div");
  vizContainer.id = "vizContainer";
  vizContainer.className = "viz-container";
  insightsDiv.appendChild(vizContainer);

  // Create chart type switcher
  createChartTypeSwitcher();

  // Display the insights container
  insightsContainer.style.display = "flex";
}

/**
 * Create the header content with title and description
 * @returns {HTMLElement} The header content element
 */
function createHeaderContent() {
  const headerContent = document.createElement("div");
  headerContent.className = "insight-header-content";

  // Add title if available
  if (state.dataInsights?.title) {
    const titleElement = document.createElement("h3");
    titleElement.className = "viz-title";
    titleElement.textContent = state.dataInsights.title;
    headerContent.appendChild(titleElement);
  }

  // Add description if available
  if (state.dataInsights?.dataDescription) {
    const descriptionElement = document.createElement("p");
    descriptionElement.className = "viz-description";
    descriptionElement.textContent = state.dataInsights.dataDescription;
    headerContent.appendChild(descriptionElement);
  }

  return headerContent;
}

/**
 * Creates and populates the chart type switcher with available chart types
 */
function createChartTypeSwitcher() {
  // Find the selector container
  const selectorContainer = document.querySelector(".viz-type-selector");
  if (!selectorContainer) return;

  // Clear existing content
  selectorContainer.innerHTML = "";

  // Create a D3 tooltip using the chart library style
  const tooltip = chartStyles.createTooltip();

  // Get available chart types or use default
  const availableChartTypes = state.availableChartTypes || ["table"];

  // Create chart type options
  availableChartTypes.forEach((typeId) => {
    // Get config or create default from type ID
    const config = CHART_TYPE_CONFIG[typeId] || createDefaultConfig(typeId);

    // Create option element
    const option = document.createElement("div");
    option.className = `chart-type-option${state.chartType === typeId ? " selected" : ""}`;
    option.dataset.chartType = typeId;

    // Try to load icon
    const iconPath = `assets/icons/${typeId}.svg`;
    option.innerHTML = `
      <img src="${iconPath}" alt="${config.label}" class="chart-icon"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <span class="material-icons" style="display:none;">${config.icon || "help_outline"}</span>
    `;

    // Setup hover events using D3 selection for consistency with chart pattern

    // IMPORTANT CHANGE: Use mousemove instead of mouseenter to follow cursor
    const selection = d3.select(option);
    selection
      .on("mousemove", function (event) {
        // Show tooltip following the cursor position
        chartStyles.tooltip.show(tooltip, event, `<strong>${config.label}</strong>`);
      })
      .on("mouseleave", function () {
        // Hide tooltip
        chartStyles.tooltip.hide(tooltip);
      });

    // Add click handler
    option.addEventListener("click", () => {
      // Update UI selection
      selectorContainer.querySelectorAll(".chart-type-option").forEach((opt) => {
        opt.classList.remove("selected");
      });
      option.classList.add("selected");

      // Update state and redraw
      state.chartType = typeId;
      visualization();

      // Hide tooltip after selection
      chartStyles.tooltip.hide(tooltip);
    });

    selectorContainer.appendChild(option);
  });
}

/**
 * Create default configuration for chart types without predefined config
 * @param {string} typeId - Chart type ID
 * @returns {Object} Chart configuration
 */
function createDefaultConfig(typeId) {
  return {
    icon: "help_outline",
    label: typeId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  };
}

/**
 * Render the currently selected chart
 */
function renderChart() {
  // Get chart container
  const chartContainer = getChartContainer();
  if (!chartContainer) return;

  // Clean up any existing charts
  cleanupVisualization(chartContainer);

  // Get the current chart type
  const chartType = state.chartType || "single_bar_chart";
  const renderer = CHART_RENDERERS[chartType];

  // Render the selected chart or show error message
  try {
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

/**
 * Get the chart container element
 * @returns {HTMLElement|null} The chart container or null if not found
 */
function getChartContainer() {
  const chartContainer =
    document.getElementById("tableContainer") ||
    document.querySelector(".viz-container") ||
    document.querySelector("#viz-container");

  if (!chartContainer) {
    console.error("Chart container not found. Check your HTML structure.");
    return null;
  }

  return chartContainer;
}

/**
 * Cleans up previous visualizations
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
  cleanupOrphanedTooltips();

  // Clear container contents
  container.innerHTML = "";
}

/**
 * Switch to a different chart type (for external use)
 * @param {string} chartType - The type of chart to switch to
 */
function switchChartType(chartType) {
  // Update state directly
  state.chartType = chartType;

  // Redraw visualization
  visualization();
}

// Export function for direct access
export default visualization;

// Make specific functions available globally if needed
window.switchChartType = switchChartType;
window.createChartTypeSwitcher = createChartTypeSwitcher;
window.updateaboutData = updateaboutData;
