/**
 * Event Handlers Module
 * Manages UI event listeners and interactions
 */
import { handleUserQuery } from "./app.js";
import { state } from "./state.js";

/**
 * Initialize all event listeners
 */
export default function initializeEventListeners() {
  setupSearchForm();
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
