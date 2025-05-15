/**
 * Main application for NYC data explorer
 */
import apiService from "./apiService.js";
import visualization from "./visualization.js";
import initializeEventListeners from "./eventHandlers.js";
import { initializeLocationCheckbox, getLocationPreference, getCurrentPosition } from "./locationService.js";

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  initializeLocationCheckbox();
  processInitialQuery();
});

// Process query passed from landing page via localStorage
function processInitialQuery() {
  const initialQuery = localStorage.getItem("initialQuery");

  if (initialQuery) {
    // Clear storage to prevent persistence across refreshes
    localStorage.removeItem("initialQuery");
    document.getElementById("promptInput").value = initialQuery;
    handleUserQuery(initialQuery);
  }
}

// Process user query and update visualization
export async function handleUserQuery(query) {
  const userQuery = query || document.getElementById("promptInput").value;

  if (!userQuery.trim()) return;

  try {
    await processQueryWithLocation(userQuery);
    visualization();
  } catch (error) {
    console.error("Error processing query:", error);
  }
}

// Add location data to query when enabled by user
async function processQueryWithLocation(query) {
  let locationData = null;

  if (getLocationPreference()) {
    try {
      locationData = await getCurrentPosition();
    } catch (error) {
      console.error("Could not get location:", error);
    }
  }

  await apiService(query, locationData);
}
