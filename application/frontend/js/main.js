import askGemini from "./askGemini.js";
import visualizeData from "./visualizeData.js";
import { state } from "./state.js";

// Initialize event listeners
function initializeEventListeners() {
  document.getElementById("promptInput").addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
      await handleUserQuery();
    }
  });

  document.querySelector("button").addEventListener("click", handleUserQuery);
}
initializeEventListeners();

// Function to handle user query
export async function handleUserQuery() {
  await askGemini();
  visualizeData();
}
