import { initializeLocationCheckbox, getLocationPreference, saveLocationPreference } from "./locationService.js";

/**
 * Landing page functionality for ASK NYC application
 */

// Sample queries for the "Surprise Me" feature
const SURPRISE_QUERIES = [
  {
    query: "Which neighborhoods had the most noise complaints?",
    requiresLocation: false,
  },
  {
    query: "What are the common complaint types in Manhattan?",
    requiresLocation: false,
  },
  {
    query: "Where are the rat hotspots in the East Village?",
    requiresLocation: false,
  },
  {
    query: "When did the most noise complaints happen?",
    requiresLocation: false,
  },
  {
    query: "Where are the rat hotspots around me?",
    requiresLocation: true,
  },
  {
    query: "Show me the noise hotspots near me",
    requiresLocation: true,
  },
  {
    query: "What are the common complaints near me?",
    requiresLocation: true,
  },
];

/**
 * Navigate to the application page with the specified query
 * @param {string} query - The query to send to the application
 */
function navigateToApp(query) {
  if (!query?.trim()) return;

  // Store query for the app page to retrieve
  localStorage.setItem("initialQuery", query);

  // Navigate to app page
  window.location.href = "app.html";
}

/**
 * Handle search form submission
 */
function handleSearch() {
  const query = document.getElementById("promptInput").value.trim();
  navigateToApp(query);
}

/**
 * Get a random query from the surprise queries list
 * @returns {Object} Contains query string and whether location is required
 */
function getRandomQuery() {
  const randomIndex = Math.floor(Math.random() * SURPRISE_QUERIES.length);
  return SURPRISE_QUERIES[randomIndex];
}

/**
 * Initialize all event listeners for the landing page
 */
function initializeEventListeners() {
  // Search button click
  document.getElementById("sendButton").addEventListener("click", handleSearch);

  // Enter key in search input
  document.getElementById("promptInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  });

  // "What can you answer?" button
  document.querySelector(".suggestion-btn").addEventListener("click", () => {
    navigateToApp("What can you answer?");
  });

  // "Surprise Me!" button with improved location checkbox handling
  document.querySelector(".surprise-btn").addEventListener("click", () => {
    const inputField = document.getElementById("promptInput");
    const locationCheckbox = document.getElementById("useLocationCheckbox");
    const randomSelection = getRandomQuery();

    // Set the query text
    inputField.value = randomSelection.query;

    // Set checkbox based on query requirements - default to OFF
    if (locationCheckbox) {
      locationCheckbox.checked = randomSelection.requiresLocation;
      saveLocationPreference(randomSelection.requiresLocation);
    }

    // Focus the input and move cursor to the end
    inputField.focus();
    const valueLength = inputField.value.length;
    inputField.setSelectionRange(valueLength, valueLength);
  });

  // Initialize the location checkbox with explicit false default
  const locationCheckbox = document.getElementById("useLocationCheckbox");
  if (locationCheckbox) {
    // Explicitly set to unchecked by default
    locationCheckbox.checked = false;

    // Save the default preference
    saveLocationPreference(false);

    // Add change listener to save preferences when user changes it
    locationCheckbox.addEventListener("change", (e) => {
      saveLocationPreference(e.target.checked);
    });
  }
}

// Initialize the page when DOM is ready
document.addEventListener("DOMContentLoaded", initializeEventListeners);
