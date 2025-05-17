import { state } from "./state.js";
import { getLocationPreference } from "./locationService.js";

// API endpoint determination based on environment
const getServerEndpoint = () => {
  return window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/process"
    : "https://thesis-production-65a4.up.railway.app/process";
};

// Prepares context object from current application state
const prepareContext = (useLocation) => {
  return {
    currentVisualization: {
      chartType: state.chartType,
      dimensions: state.aggregationDefinition?.dimensions || [],
      measures: state.aggregationDefinition?.measures || [],
      preAggregationFilters: state.aggregationDefinition?.preAggregationFilters || "",
      postAggregationFilters: state.aggregationDefinition?.postAggregationFilters || "",
      topN: state.aggregationDefinition?.topN || null,
    },
    conversationHistory: state.conversationHistory || [],
    locationEnabled: useLocation,
  };
};

// Main API service function
export async function apiService(query, locationData) {
  const loader = document.getElementById("loader");
  loader.classList.add("visible");

  try {
    // Use passed query or get from input
    const userQuery = query || document.getElementById("promptInput").value;
    state.userQuery = userQuery;

    // Check if location is enabled
    const useLocation = getLocationPreference();

    // Prepare request data
    const requestBody = {
      prompt: userQuery,
      context: prepareContext(useLocation),
    };

    // Add location if available
    if (locationData && useLocation) {
      requestBody.location = locationData;
    }

    // Send request to backend
    const response = await fetch(getServerEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    // Process response
    const result = await response.json();
    updateStateFromResponse(result, userQuery);
  } catch (error) {
    console.error("Error in apiService:", error);
  } finally {
    loader.classList.remove("visible");
  }
}

// Updates application state with API response data
function updateStateFromResponse(result, userQuery) {
  const dataInsights = result.dataInsights || {};

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
      filterDescription: dataInsights.filterDescription || [],
    },
    dataMetadataAll: result.dataMetadataAll || {},
  });

  // Update conversation history
  state.updateConversationHistory(userQuery, result.textResponse || result.dataInsights?.dataDescription);
}

export default apiService;
