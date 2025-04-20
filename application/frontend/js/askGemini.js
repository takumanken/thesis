import { state } from "./state.js";
import { updateChartTypeDropdown } from "./events.js";
import { getCurrentPosition } from "./locationService.js";

export async function askGemini() {
  const userQuery = document.getElementById("promptInput").value;
  state.userQuery = userQuery;

  // Check if location checkbox is checked
  const useLocation = document.getElementById("useLocationCheckbox").checked;
  let locationData = null;

  // If location is requested, get the current position
  if (useLocation) {
    try {
      locationData = await getCurrentPosition();
    } catch (error) {
      console.error("Failed to get location:", error);
      alert("Unable to access your location. Please check your browser permissions.");
    }
  }

  const hostname = window.location.hostname;
  const serverEndpoint =
    hostname === "127.0.0.1"
      ? "http://localhost:8000/process"
      : "https://thesis-production-65a4.up.railway.app/process";

  console.log("Using server endpoint:", serverEndpoint);

  // Create the request body with optional location data
  const requestBody = {
    prompt: userQuery,
  };

  // Add location data if available
  if (locationData) {
    requestBody.location = locationData;
    console.log("Including location in query:", locationData);
  }

  try {
    const response = await fetch(serverEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log("Raw response from backend:", result);

    // Create a proper dataInsights object
    const dataInsights = result.dataInsights || {};

    // Update state with the exact structure from the API response
    state.update({
      fields: result.fields || [],
      dataset: result.dataset || [],
      aggregationDefinition: result.aggregationDefinition || {},
      sql: result.sql || "",
      chartType: result.chartType || "table",
      availableChartTypes: result.availableChartTypes || ["table"],
      textResponse: result.textResponse || null,
      dataInsights: {
        title: dataInsights.title || null,
        dataDescription: dataInsights.dataDescription || null,
        filter_description: dataInsights.filter_description || [],
      },
    });

    updateChartTypeDropdown();
  } catch (error) {
    console.error("Error in askGemini:", error);
  }
}

export default askGemini;
