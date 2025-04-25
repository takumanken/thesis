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
    filter_description: [],
  },
  dataMetadataAll: {},
  // Track original data sources from API
  originalDataSources: null,
  // Update method
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

    // Handle dataInsights property
    if (newData.dataInsights) {
      this.dataInsights = {
        title: newData.dataInsights.title || null,
        dataDescription: newData.dataInsights.dataDescription || null,
        filter_description: newData.dataInsights.filter_description || [],
      };
    }
    // Handle legacy flat structure
    else {
      this.dataInsights = {
        title: newData.title || null,
        dataDescription: newData.dataDescription || null,
        filter_description: newData.filter_description || [],
      };
    }

    const chartTypeSelector = document.getElementById("chartTypeSelector");
    if (chartTypeSelector) {
      chartTypeSelector.value = this.chartType || "table";
    }

    // Store original data sources when initially loading
    if (newData.aggregationDefinition?.datasourceMetadata) {
      this.originalDataSources = [...newData.aggregationDefinition.datasourceMetadata];
    }
  },

  /**
   * Adds a data source to the current visualization by ID
   * @param {number} dataSourceId - The ID of the data source to add
   * @returns {boolean} - Whether the operation was successful
   */
  addDataSource(dataSourceId) {
    try {
      // Find the data source in the metadata
      const dataSource = this.dataMetadataAll.data_sources.find((ds) => ds.data_source_id === dataSourceId);

      // Check if this data source is already included
      const exists = this.aggregationDefinition.datasourceMetadata.some((ds) => ds.data_source_id === dataSourceId);

      // Add it if it's not already included
      if (!exists) {
        this.aggregationDefinition.datasourceMetadata.push(dataSource);
        updateAboutData(); // Update the About Data section
        return true;
      }

      return false; // No change made
    } catch (error) {
      console.error("Error adding data source:", error);
      return false;
    }
  },

  /**
   * Resets data sources to the original set from the API response
   * Removes any sources added by chart components
   */
  resetDataSources() {
    if (this.originalDataSources && this.aggregationDefinition) {
      this.aggregationDefinition.datasourceMetadata = [...this.originalDataSources];
      updateAboutData(); // Update the About Data section to reflect changes
      return true;
    }
    return false;
  },
};
