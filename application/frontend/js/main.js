import askGemini from "./askGemini.js";
import visualizeData from "./visualizeData.js";
import initializeEventListeners from "./events.js";

// Initialize event listeners
initializeEventListeners();

export async function handleUserQuery() {
  await askGemini();
  visualizeData();
}
