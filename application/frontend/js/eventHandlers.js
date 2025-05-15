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
  setupSearchForm();
  setupChartSelectors();
}

/**
 * Set up search form and location checkbox
 */
function setupSearchForm() {
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

  // Track user location preference for query context
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
  // Find chart type selector element
  const selector = document.getElementById("chartTypeSelector");

  if (selector) {
    selector.addEventListener("change", (e) => {
      if (e.target.value !== state.chartType) {
        state.chartType = e.target.value;
        visualization();
      }
    });
  }

  updateChartTypeSelectors();
}

/**
 * Update chart type dropdown with available options
 */
export function updateChartTypeSelectors() {
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
 * Format chart type for display (e.g., "line_chart" -> "Line Chart")
 */
function formatChartTypeName(type) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
