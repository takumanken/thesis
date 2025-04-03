import { state } from "./state.js";

let currentGridInstance = null;

function visualizeData() {
  const { dataset, chartType } = state;
  const container = document.getElementById("tableContainer");

  // Exit if there's no dataset
  if (!dataset || !dataset.length) {
    container.innerHTML = "<p>No data available</p>";
    return;
  }

  // Clean up previous instance
  if (currentGridInstance) {
    currentGridInstance.destroy();
    currentGridInstance = null;
  }

  container.innerHTML = "";

  const fields = Object.keys(dataset[0]);
  currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: { limit: 50 },
  }).render(container);
}

export default visualizeData;
