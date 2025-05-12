/**
 * Main application module
 *
 * Handles initialization and query processing for the NYC data explorer app
 */
import apiService from "./apiService.js";
import visualization from "./visualization.js";
import initializeEventListeners from "./eventHandlers.js";

// Application initialization when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize event listeners first so they're available
  initializeEventListeners();

  // Process any query passed from landing page
  processInitialQuery();
});

/**
 * Process any query that was passed from the landing page via localStorage
 */
function processInitialQuery() {
  const initialQuery = localStorage.getItem("initialQuery");

  if (initialQuery) {
    // Clear it from storage so it doesn't persist across page refreshes
    localStorage.removeItem("initialQuery");

    // Set the query in the input field
    document.getElementById("promptInput").value = initialQuery;

    // Automatically submit the query using the existing function
    handleUserQuery(initialQuery);
  }
}

/**
 * Process a user query and update visualization
 *
 * @param {string} query - Optional query parameter (uses input value if not provided)
 */
export async function handleUserQuery(query) {
  // If a query parameter is provided, use it; otherwise get from input
  const userQuery = query || document.getElementById("promptInput").value;

  // Make sure there's text in the query
  if (!userQuery.trim()) return;

  // Call API service with the query and update visualization
  try {
    await apiService(userQuery);
    visualization();
  } catch (error) {
    console.error("Error processing query:", error);
  }
}
