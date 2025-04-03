import { state } from "./state.js";

export async function askGemini() {
  // Get the user query from the input field
  const userQuery = document.getElementById("promptInput").value;
  state.userQuery = userQuery;

  // Process the user query through backend API
  const response = await fetch("https://thesis-production-65a4.up.railway.app/process", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: userQuery }),
  });

  // Update state with the response data
  const result = await response.json();
  state.dataset = result.dataset;
  state.chartType = result.chart_type;
}

export default askGemini;
