import apiService from "./apiService.js";
import visualization from "./visualization.js";
import initializeEventListeners from "./eventHandlers.js";

// Make sure DOM is ready before initializing event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Initialize event listeners here
  initializeEventListeners();
});

export async function handleUserQuery() {
  await apiService();
  visualization();
}
