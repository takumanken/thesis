import { state } from "./state.js";

export async function askGemini() {
  const userQuery = document.getElementById("promptInput").value;
  state.userQuery = userQuery;

  const response = await fetch("https://thesis-production-65a4.up.railway.app/process", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: userQuery }),
  });

  const result = await response.json();

  // Update the state using the update method
  state.update({
    dataset: result.dataset,
    chartType: result.chart_type,
    aggregationDefinition: result.aggregation_definition,
    sql: result.sql,
  });

  console.log("Response from backend:", result);
  console.log("State after processing:", state);
}

export default askGemini;
