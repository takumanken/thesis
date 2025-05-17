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
    this.userQuery = newData.userQuery || this.userQuery;
    this.dataset = newData.dataset || [];
    this.fields = newData.fields || [];
    this.sql = newData.sql || "";
    this.aggregationDefinition = newData.aggregationDefinition || {};
    this.chartType = newData.chartType || "table";
    this.availableChartTypes = newData.availableChartTypes || ["table"];
    this.textResponse = newData.textResponse || null;
    this.dataMetadataAll = newData.dataMetadataAll || {};
    this.dataInsights = {
      title: newData.dataInsights.title || null,
      dataDescription: newData.dataInsights.dataDescription || null,
      filterDescription: newData.dataInsights.filterDescription || [],
    };
    this.originalDataSources = [...newData.aggregationDefinition.datasourceMetadata];
  },

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

  /**
   * Resets data sources to the original set from the API response
   * @returns {boolean} Whether reset was successful
   */
  resetDataSources() {
    if (this.originalDataSources && this.aggregationDefinition) {
      this.aggregationDefinition.datasourceMetadata = [...this.originalDataSources];
      updateAboutData();
      return true;
    }
    return false;
  },

  /**
   * Updates conversation history with current message and visualization state
   * @param {string} userMessage - The message from the user
   * @param {string} aiResponse - The response from the AI
   * @returns {Array} The updated conversation history
   */
  updateConversationHistory(userMessage, aiResponse) {
    const conversationEntry = {
      timestamp: new Date().toISOString(),
      userMessage,
      aiResponse,
      visualizationState: {
        chartType: this.chartType,
        dataset: {
          length: this.dataset?.length || 0,
          sample: this.dataset?.slice(0, 10) || [],
        },
        dimensions: this.aggregationDefinition?.dimensions?.slice() || [],
        measures: JSON.parse(JSON.stringify(this.aggregationDefinition?.measures || [])),
        preAggregationFilters: this.aggregationDefinition?.preAggregationFilters || "",
        postAggregationFilters: this.aggregationDefinition?.postAggregationFilters || "",
        topNFilters: this.aggregationDefinition?.topN || {},
      },
    };

    // Maintain limited history size for performance
    this.conversationHistory = [conversationEntry, ...this.conversationHistory.slice(0, 4)];

    return this.conversationHistory;
  },
};
