import { updateAboutData } from "./aboutData.js";
import { getCurrentPosition, getLocationPreference } from "./locationService.js";

export const state = {
  userQuery: "",
  dataset: [],
  fields: [],
  sql: "",
  aggregationDefinition: {},
  chartType: "table",
  availableChartTypes: ["table"],
  textResponse: null,
  dataInsights: {
    title: null,
    dataDescription: null,
    filterDescription: [],
  },
  dataMetadataAll: {},
  originalDataSources: null,
  conversationHistory: [],
  lastLocationFetch: null,
  currentLocation: null,

  // Updates application state with new data while preserving defaults
  update(newData) {
    // Use nullish coalescing to update properties only when provided
    this.userQuery = newData.userQuery ?? this.userQuery;
    this.dataset = newData.dataset ?? [];
    this.fields = newData.fields ?? [];
    this.sql = newData.sql ?? "";
    this.aggregationDefinition = newData.aggregationDefinition ?? {};
    this.chartType = newData.chartType ?? "table";
    this.availableChartTypes = newData.availableChartTypes ?? ["table"];
    this.textResponse = newData.textResponse ?? null;
    this.dataMetadataAll = newData.dataMetadataAll ?? {};

    // Update data insights if provided
    if (newData.dataInsights) {
      this.dataInsights = {
        title: newData.dataInsights.title ?? null,
        dataDescription: newData.dataInsights.dataDescription ?? null,
        filterDescription: newData.dataInsights.filterDescription ?? [],
      };
    }

    // Save original data sources for reset capability
    if (newData.aggregationDefinition?.datasourceMetadata) {
      this.originalDataSources = [...newData.aggregationDefinition.datasourceMetadata];
    }
  },

  // Add data source to visualization by ID
  addDataSource(dataSourceId) {
    try {
      const dataSource = this.dataMetadataAll.data_sources.find((ds) => ds.data_source_id === dataSourceId);

      const exists = this.aggregationDefinition.datasourceMetadata.some((ds) => ds.data_source_id === dataSourceId);

      if (!exists && dataSource) {
        this.aggregationDefinition.datasourceMetadata.push(dataSource);
        updateAboutData();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error adding data source:", error);
      return false;
    }
  },

  // Reset data sources to original set from API response
  resetDataSources() {
    if (this.originalDataSources && this.aggregationDefinition) {
      this.aggregationDefinition.datasourceMetadata = [...this.originalDataSources];
      updateAboutData();
      return true;
    }
    return false;
  },

  // Save current UI state with conversation for history tracking
  updateConversationHistory(userMessage, aiResponse) {
    const conversationEntry = {
      timestamp: new Date().toISOString(),
      userMessage,
      aiResponse,
      visualizationState: {
        chartType: this.chartType,
        dataset: {
          length: this.dataset?.length ?? 0,
          sample: this.dataset?.slice(0, 10) ?? [],
        },
        dimensions: this.aggregationDefinition?.dimensions?.slice() ?? [],
        // Deep copy needed for nested objects
        measures: JSON.parse(JSON.stringify(this.aggregationDefinition?.measures ?? [])),
        preAggregationFilters: this.aggregationDefinition?.preAggregationFilters ?? "",
        postAggregationFilters: this.aggregationDefinition?.postAggregationFilters ?? "",
        topNFilters: this.aggregationDefinition?.topN ?? {},
      },
    };

    // Keep only 5 most recent conversations for performance
    this.conversationHistory = [conversationEntry, ...this.conversationHistory.slice(0, 4)];

    return this.conversationHistory;
  },

  // Get or fetch the current location
  async getOrFetchLocation() {
    // Return cached location if recent (within last 5 minutes)
    const LOCATION_CACHE_TIME = 5 * 60 * 1000;
    const now = Date.now();

    if (this.currentLocation && this.lastLocationFetch && now - this.lastLocationFetch < LOCATION_CACHE_TIME) {
      return this.currentLocation;
    }

    // Fetch new location
    if (getLocationPreference()) {
      try {
        this.currentLocation = await getCurrentPosition();
        this.lastLocationFetch = now;
        return this.currentLocation;
      } catch (error) {
        console.error("Could not get location:", error);
        return null;
      }
    }

    return null;
  },
};
