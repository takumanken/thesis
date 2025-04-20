/**
 * Event Handlers Module
 * Manages UI event listeners and interactions
 */
import { handleUserQuery } from "./app.js";
import { state } from "./state.js";
import visualization from "./visualization.js";

/**
 * Initialize all event listeners
 */
export default function initializeEventListeners() {
  // Set up search functionality
  setupSearchForm();

  // Set up chart type selectors
  setupChartSelectors();
}

/**
 * Set up search form and location checkbox
 */
function setupSearchForm() {
  // Search input and button
  const promptInput = document.getElementById("promptInput");
  const sendButton = document.getElementById("sendButton");

  if (promptInput) {
    promptInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") handleUserQuery();
    });
  }

  if (sendButton) {
    sendButton.addEventListener("click", handleUserQuery);
  }

  // Location checkbox
  const locationCheckbox = document.getElementById("useLocationCheckbox");
  if (locationCheckbox) {
    locationCheckbox.addEventListener("change", (e) => {
      state.useLocation = e.target.checked;
    });
  }
}

/**
 * Set up chart type selector(s)
 */
function setupChartSelectors() {
  // Find all chart type selectors (dropdown and visual selector)
  const selectors = [document.getElementById("chartTypeSelector"), document.getElementById("chartTypeDropdown")].filter(
    Boolean
  );

  // Add change listeners to all selectors
  selectors.forEach((selector) => {
    selector.addEventListener("change", (e) => {
      if (e.target.value !== state.chartType) {
        state.chartType = e.target.value;
        visualization();
      }
    });
  });

  // Initialize dropdown with available chart types
  updateChartTypeDropdown();
}

/**
 * Update chart type dropdown with available options
 */
export function updateChartTypeDropdown() {
  const dropdown = document.getElementById("chartTypeSelector");
  if (!dropdown) return;

  // Clear existing options
  dropdown.innerHTML = "";

  // Add available chart types
  state.availableChartTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = formatChartTypeName(type);
    option.selected = type === state.chartType;
    dropdown.appendChild(option);
  });
}

/**
 * Format chart type for display (e.g., "line_chart" -> "Line Chart")
 */
function formatChartTypeName(type) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
