/**
 * Landing page functionality for ASK NYC application
 */

// Sample queries for the "Surprise Me" feature
const SURPRISE_QUERIES = [
  "Which neighborhoods have the most noise complaints",
  "What are the common complaint types in Manhattan?",
  "Where are the rat hotspots in East Village?",
  "What are the most common complaints in Brooklyn?",
  "How many 311 complaints are filed every day?",
  "What are the most common complaints in the Bronx?",
  "When is the timing of the illegal fireworks complaints?",
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
 * @returns {string} A randomly selected query
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

  // "Surprise Me!" button
  document.querySelector(".surprise-btn").addEventListener("click", () => {
    const inputField = document.getElementById("promptInput");
    inputField.value = getRandomQuery();

    // Focus the input and move cursor to the end
    inputField.focus();
    const valueLength = inputField.value.length;
    inputField.setSelectionRange(valueLength, valueLength);
  });
}

// Initialize the page when DOM is ready
document.addEventListener("DOMContentLoaded", initializeEventListeners);
