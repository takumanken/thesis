import { state } from "./state.js";
import renderTable from "./chart/table.js";
import renderBarChart from "./chart/single_bar_chart.js";
import renderLineChart from "./chart/line_chart.js";
import renderGroupedBarChart from "./chart/grouped_bar_chart.js";
import renderChoroplethMap from "./chart/choropleth_map.js";

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

// Main function to render chart based on chartType.
function visualizeData() {
  const { chartType } = state;
  const container = document.getElementById("tableContainer");
  cleanupVisualization(container);

  switch (chartType) {
    case "table":
      renderTable(container);
      break;
    case "single_bar_chart":
      renderBarChart(container);
      break;
    case "grouped_bar_chart":
      renderGroupedBarChart(container);
      break;
    case "line_chart":
      renderLineChart(container);
      break;
    case "choropleth_map":
      renderChoroplethMap(container);
      break;
    default:
      container.innerHTML = `<p>Chart type "${chartType}" is not supported.</p>`;
  }
}

export default visualizeData;
