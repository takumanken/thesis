import { state } from "./state.js";
import { updateChartTypeDropdown } from "./events.js";

export async function askGemini() {
  const userQuery = document.getElementById("promptInput").value;
  state.userQuery = userQuery;
  const hostname = window.location.hostname;
  const serverEndpoint =
    hostname === "127.0.0.1"
      ? "http://localhost:8000/process"
      : "https://thesis-production-65a4.up.railway.app/process";

  console.log("Using server endpoint:", serverEndpoint);

  const response = await fetch(serverEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: userQuery }),
  });

  const result = await response.json();

  // Update how backend response is mapped to state
  state.update({
    fields: result.fields,
    dataset: result.dataset,
    aggregationDefinition: result.aggregationDefinition,
    sql: result.sql,
    chartType: result.chartType,
    availableChartTypes: result.availableChartTypes,
    textResponse: result.textResponse,
  });

  updateChartTypeDropdown();

  console.log("Response from backend:", result);
  console.log("State after processing:", state);
}

export default askGemini;
