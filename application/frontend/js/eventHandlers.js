import { handleUserQuery } from "./app.js";
import { state } from "./state.js";
import visualization from "./visualization.js";

/**
 * Updates the chart type dropdown with available chart types
 */
export function updateChartTypeDropdown() {
  const dropdown = document.getElementById("chartTypeSelector");
  if (!dropdown) return;

  dropdown.innerHTML = "";

  state.availableChartTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = formatChartTypeName(type);
    option.selected = type === state.chartType;
    dropdown.appendChild(option);
  });
}

/**
 * Formats chart type names for display (e.g., "single_bar_chart" -> "Single Bar Chart")
 */
function formatChartTypeName(type) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Handles chart type changes from any selector
 */
function handleChartTypeChange(value) {
  if (value === state.chartType) return; // No change
  state.chartType = value;
  visualization();
}

/**
 * Initializes all event listeners
 */
export function initializeEventListeners() {
  // Search functionality
  setupSearchListeners();

  // Chart type selectors
  setupChartSelectors();

  // Always update the dropdown on initialization
  updateChartTypeDropdown();
}

/**
 * Sets up search input and button listeners
 */
function setupSearchListeners() {
  const promptInput = document.getElementById("promptInput");
  const sendButton = document.getElementById("sendButton");

  if (!promptInput || !sendButton) return;

  promptInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") handleUserQuery();
  });

  sendButton.addEventListener("click", handleUserQuery);

  // Optional location checkbox
  const locationCheckbox = document.getElementById("useLocationCheckbox");
  if (locationCheckbox) {
    locationCheckbox.addEventListener("change", function (event) {
      // Location handling logic would go here
      state.useLocation = event.target.checked;
    });
  }
}

/**
 * Sets up chart type selection listeners
 */
function setupChartSelectors() {
  // Primary chart type selector
  const chartTypeSelector = document.getElementById("chartTypeSelector");
  if (chartTypeSelector) {
    chartTypeSelector.addEventListener("change", (event) => {
      handleChartTypeChange(event.target.value);
    });
  }

  // Alternative chart dropdown (if it exists)
  const chartDropdown = document.getElementById("chartTypeDropdown");
  if (chartDropdown) {
    chartDropdown.addEventListener("change", (event) => {
      handleChartTypeChange(event.target.value);
    });
  }
}

export default initializeEventListeners;
