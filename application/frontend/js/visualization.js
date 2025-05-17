/**
 * Data Visualization Module
 * Handles rendering of charts and visualizations based on application state
 */
import { state } from "./state.js";
import { chartControls } from "./chart/utils/chartControls.js";
import { chartStyles } from "./chart/utils/chartStyles.js";
import { cleanupOrphanedTooltips } from "./chart/utils/chartUtils.js";
import { updateAboutData, updateDataSourcePills } from "./aboutData.js";

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

// Chart type configuration with icons and labels for UI representation
const CHART_CONFIG = {
  table: { icon: "table_chart", label: "Table", renderer: renderTable },
  single_bar_chart: { icon: "bar_chart", label: "Bar Chart", renderer: renderBarChart },
  line_chart: { icon: "show_chart", label: "Line Chart", renderer: renderLineChart },
  choropleth_map: { icon: "map", label: "Map", renderer: renderChoroplethMap },
  heatmap: { icon: "grain", label: "Heat Map", renderer: renderPointMap },
  grouped_bar_chart: { icon: "view_column", label: "Grouped Bar Chart", renderer: renderGroupedBarChart },
  stacked_bar_chart: { icon: "stacked_bar_chart", label: "Stacked Bar Chart", renderer: renderStackedBarChart },
  stacked_bar_chart_100: { icon: "stacked_bar_chart", label: "100% Stacked Bar", renderer: renderStackedBarChart },
  stacked_area_chart: { icon: "area_chart", label: "Area Chart", renderer: renderStackedAreaChart },
  stacked_area_chart_100: { icon: "area_chart", label: "100% Area Chart", renderer: renderStackedAreaChart },
  treemap: { icon: "grid_view", label: "Treemap", renderer: renderTreemap },
  nested_bar_chart: { icon: "view_list", label: "Nested Bar Chart", renderer: renderNestedBarChart },
  text: { icon: "text_fields", label: "Text Response", renderer: renderTextResponse },
};

/**
 * Main visualization function - renders the appropriate chart based on state
 */
function visualizeData() {
  // Find containers
  const container = document.querySelector(".visualization-area");
  const wrapper = document.querySelector(".dashboard-panel");

  // Reset state and prepare for new visualization
  state.dimensionsSwapped = false;
  chartControls.removeExistingControl();

  // Clear and set up container
  container.innerHTML = "";

  // Add header content (title & description)
  container.appendChild(createHeader());

  // Create chart container
  const chartContainer = document.createElement("div");
  chartContainer.id = "vizContainer";
  chartContainer.className = "viz-container";
  container.appendChild(chartContainer);

  // Update chart type selector
  createChartTypeSwitcher();

  // Update About Data section
  updateAboutData();
  updateDataSourcePills();

  // Show container and render the chart
  wrapper.style.display = "flex";
  renderChart(chartContainer);
}

/**
 * Create header with title and description
 */
function createHeader() {
  const header = document.createElement("div");
  header.className = "insight-header-content";

  if (state.dataInsights?.title) {
    const title = document.createElement("h3");
    title.className = "viz-title";
    title.textContent = state.dataInsights.title;
    header.appendChild(title);
  }

  if (state.dataInsights?.dataDescription) {
    const description = document.createElement("p");
    description.className = "viz-description";
    description.textContent = state.dataInsights.dataDescription;
    header.appendChild(description);
  }

  return header;
}

/**
 * Create chart type selector with available chart types
 */
function createChartTypeSwitcher() {
  const selector = document.querySelector(".viz-type-selector");

  selector.innerHTML = "";
  const tooltip = chartStyles.createTooltip();
  const chartTypes = state.availableChartTypes;

  chartTypes.forEach((typeId) => {
    // Get chart config
    const config = CHART_CONFIG[typeId];

    // Create option element
    const option = document.createElement("div");
    option.className = `chart-type-option${state.chartType === typeId ? " selected" : ""}`;
    option.dataset.chartType = typeId;

    // Add icon (SVG or material icon fallback)
    option.innerHTML = `
      <img src="assets/icons/${typeId}.svg" alt="${config.label}" class="chart-icon"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <span class="material-icons" style="display:none;">${config.icon}</span>
    `;

    // Add tooltip
    d3.select(option)
      .on("mousemove", (event) => chartStyles.tooltip.show(tooltip, event, `<strong>${config.label}</strong>`))
      .on("mouseleave", () => chartStyles.tooltip.hide(tooltip));

    // Add click handler
    option.addEventListener("click", () => {
      // Update selection
      selector.querySelectorAll(".chart-type-option").forEach((opt) => opt.classList.remove("selected"));
      option.classList.add("selected");

      // Update chart
      state.chartType = typeId;
      visualizeData();
      chartStyles.tooltip.hide(tooltip);
    });

    selector.appendChild(option);
  });
}

/**
 * Render the selected chart
 */
function renderChart(container) {
  if (!container) return;

  // Clean up existing visualizations
  cleanupVisualization(container);

  // Get chart type and renderer
  const chartType = state.chartType;
  const config = CHART_CONFIG[chartType];

  try {
    if (config?.renderer) {
      config.renderer(container);
    } else {
      container.innerHTML = `<p>Chart type "${chartType}" is not supported.</p>`;
    }
  } catch (error) {
    console.error(`Error rendering ${chartType} chart:`, error);
    container.innerHTML = `<p>Error rendering chart. Please try a different chart type.</p>`;
  }
}

/**
 * Clean up previous visualizations to prevent memory leaks
 */
function cleanupVisualization(container) {
  // Destroy grid instance if exists
  if (state.currentGridInstance) {
    state.currentGridInstance.destroy();
    state.currentGridInstance = null;
  }

  // Remove current chart
  if (state.currentChart && container.contains(state.currentChart)) {
    container.removeChild(state.currentChart);
  }

  state.resetDataSources();

  state.currentChart = null;
  cleanupOrphanedTooltips();
  container.innerHTML = "";
}

export default visualizeData;
