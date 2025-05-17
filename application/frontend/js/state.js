import { updateAboutData } from "./aboutData.js";

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
};
