import askGemini from "./askGemini.js";
import visualizeData from "./visualizeData.js";

async function handleUserQuery() {
  const promptInput = document.getElementById("promptInput");

  try {
    const result = await askGemini(promptInput.value);

    const dataset = result.dataset;
    const chartType = result.chart_type;

    visualizeData(dataset);
  } catch (error) {
    // container.textContent = error.message;
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
