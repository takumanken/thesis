import { state } from "./state.js";
import { updateChartTypeDropdown } from "./eventHandlers.js";
import { getCurrentPosition } from "./locationService.js";

export async function apiService() {
  // Show loading spinner
  const loader = document.getElementById("loader");
  loader.classList.add("visible");

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

  // Create the current context object
  const currentContext = {
    currentVisualization: {
      chartType: state.chartType,
      dimensions: state.aggregationDefinition?.dimensions || [],
      measures: state.aggregationDefinition?.measures || [],
      preAggregationFilters: state.aggregationDefinition?.preAggregationFilters || "",
      postAggregationFilters: state.aggregationDefinition?.postAggregationFilters || "",
      topN: state.aggregationDefinition?.topN || null,
    },
    conversationHistory: state.conversationHistory || [],
  };

  // Create the request body with prompt, context, and optional location
  const requestBody = {
    prompt: userQuery,
    context: currentContext,
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
      schemaMetadata: result.schemaMetadata || null,
      dataInsights: {
        title: dataInsights.title || null,
        dataDescription: dataInsights.dataDescription || null,
        filter_description: dataInsights.filter_description || [],
      },
      dataMetadataAll: result.dataMetadataAll || {},
    });

    // Store conversation history after state is updated
    state.updateConversationHistory(userQuery, result.dataInsights?.dataDescription || "Visualization generated");

    updateChartTypeDropdown();
  } catch (error) {
    console.error("Error in apiService:", error);
  } finally {
    // Hide loading spinner when done (whether successful or not)
    loader.classList.remove("visible");
  }
}

export default apiService;
