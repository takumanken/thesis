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
  // For prompt input and send button (standard elements)
  const promptInput = document.getElementById("promptInput");
  const sendButton = document.getElementById("sendButton");
  if (promptInput && sendButton) {
    // Input keyup event (e.g., for pressing Enter)
    promptInput.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        handleUserQuery();
      }
    });

    // Send button click
    sendButton.addEventListener("click", handleUserQuery);
  } else {
    console.warn("Search elements not found: promptInput or sendButton");
  }

  // Location checkbox
  const locationCheckbox = document.getElementById("useLocationCheckbox");
  if (locationCheckbox) {
    locationCheckbox.addEventListener("change", function (event) {
      // Your location handling code
    });
  } else {
    console.warn("Element not found: useLocationCheckbox");
  }

  // Chart type selector - this appears to be missing or renamed
  const chartTypeSelector = document.getElementById("chartTypeSelector");
  if (chartTypeSelector) {
    chartTypeSelector.addEventListener("change", function (event) {
      // Chart type change handling
      state.chartType = event.target.value;
      visualizeData();
    });
  } else {
    console.warn("Element not found: chartTypeSelector");
  }

  // Chart dropdown - this appears to be missing or renamed
  const chartDropdown = document.getElementById("chartTypeDropdown");
  if (chartDropdown) {
    chartDropdown.addEventListener("change", function (event) {
      // Chart dropdown handling
      state.chartType = event.target.value;
    });
  } else {
    console.warn("Element not found: chartTypeDropdown");
  }

  // Always update the dropdown on initialization.
  updateChartTypeDropdown();
}

export default initializeEventListeners;
