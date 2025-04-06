import { state } from "./state.js";
import renderTable from "./chart/table.js";
import renderBarChart from "./chart/bar_chart.js";
import renderLineChart from "./chart/line_chart.js";
import renderMap from "./chart/map.js";

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
    case "bar_chart":
      renderBarChart(container);
      break;
    case "line_chart":
      renderLineChart(container);
      break;
    case "map":
      renderMap(container);
      break;
    default:
      container.innerHTML = `<p>Chart type "${chartType}" is not supported.</p>`;
  }
}

export default visualizeData;
