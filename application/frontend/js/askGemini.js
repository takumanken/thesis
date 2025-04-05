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

  // Update the state using camelCase keys consistently.
  state.update({
    fields: result.fields,
    dataset: result.dataset,
    aggregationDefinition: result.aggregation_definition,
    sql: result.sql,
    chartType: result.chart_type,
    availableChartTypes: result.available_chart_types,
  });

  console.log("Response from backend:", result);
  console.log("State after processing:", state);
}

export default askGemini;
