import { handleUserQuery } from "./main.js";
import { state } from "./state.js";
import visualizeData from "./visualizeData.js";

export function updateChartTypeDropdown() {
  const dropdown = document.getElementById("chartTypeSelector");
  if (!dropdown) return;
  // Clear any existing options.
  dropdown.innerHTML = "";
  // Populate dropdown using availableChartTypes from state.
  state.availableChartTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    if (type === state.chartType) {
      option.selected = true;
    }
    dropdown.appendChild(option);
  });
}

export function initializeEventListeners() {
  document.getElementById("promptInput").addEventListener("keypress", (event) => {
    if (event.key === "Enter") handleUserQuery();
  });

  document.querySelector("button").addEventListener("click", handleUserQuery);

  document.getElementById("chartTypeSelector").addEventListener("change", (event) => {
    state.chartType = event.target.value;
    visualizeData();
  });

  const dropdown = document.getElementById("chartTypeDropdown");
  if (dropdown) {
    dropdown.addEventListener("change", (e) => {
      // Update state when user changes selection.
      state.chartType = e.target.value;
      // Optionally trigger visualization re-render here.
    });
  }
  // Always update the dropdown on initialization.
  updateChartTypeDropdown();
}

export default initializeEventListeners;
