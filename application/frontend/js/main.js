import askGemini from "./askGemini.js";
import visualizeData from "./visualizeData.js";
import initializeEventListeners from "./events.js";

// Make sure DOM is ready before initializing event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Initialize event listeners here
  initializeEventListeners();
});

export async function handleUserQuery() {
  await askGemini();
  visualizeData();
}
