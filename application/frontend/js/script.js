import askGemini from "./askGemini.js";
import visualizeData from "./visualizeData.js";

async function handleUserQuery() {
  const promptInput = document.getElementById("promptInput");
  const container = document.getElementById("tableContainer");

  try {
    const result = await askGemini(promptInput.value);

    const {
      aggregation_definition: { fields },
      dataset,
    } = result;

    visualizeData(container, fields, dataset);
  } catch (error) {
    container.textContent = error.message;
  }
}

function initializeEventListeners() {
  document.getElementById("promptInput").addEventListener("keypress", async (event) => {
    if (event.key === "Enter") {
      await handleUserQuery();
    }
  });

  document.querySelector("button").addEventListener("click", handleUserQuery);
}

initializeEventListeners();
