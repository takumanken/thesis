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
  if (state.currentGridInstance) {
    state.currentGridInstance.destroy();
    state.currentGridInstance = null;
  }
  if (state.currentChart) {
    container.removeChild(state.currentChart);
    state.currentChart = null;
  }
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

// Update the updateDataInsights function for better formatting

function updateDataInsights() {
  const container = document.getElementById("dataInsightsContainer");
  const insightsEl = document.getElementById("dataInsights");

  if (!container || !insightsEl) return;

  // Get values from state
  const description = state.dataDescription || "";
  const answer = state.directAnswer || "";

  // Combine them into a single text
  let insightText = "";

  if (description) {
    insightText += description;
  }

  if (answer && answer.trim()) {
    // Use nicer formatting for the separator
    if (description) {
      // Use HTML for better styling
      insightsEl.textContent = description;

      const separator = document.createElement("span");
      separator.className = "insight-separator";
      separator.textContent = " → ";
      insightsEl.appendChild(separator);

      const answerSpan = document.createElement("span");
      answerSpan.textContent = answer;
      answerSpan.style.fontWeight = "500";
      insightsEl.appendChild(answerSpan);

      container.style.display = "block";
      return;
    } else {
      insightText = answer;
    }
  }

  // Update display
  if (insightText.trim()) {
    insightsEl.textContent = insightText;
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

// Main function to render chart based on chartType.
export default function visualizeData() {
  const chartContainer = document.getElementById("tableContainer");
  cleanupVisualization(chartContainer);

  // Add this new function call at the beginning
  updateDataInsights();

  // Handle the special case first
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
