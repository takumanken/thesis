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
  },

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

    // Handle dataInsights property
    if (newData.dataInsights) {
      this.dataInsights = {
        title: newData.dataInsights.title || null,
        dataDescription: newData.dataInsights.dataDescription || null,
      };
    }
    // Handle legacy flat structure
    else {
      this.dataInsights = {
        title: newData.title || null,
        dataDescription: newData.dataDescription || null,
      };
    }

    const chartTypeSelector = document.getElementById("chartTypeSelector");
    if (chartTypeSelector) {
      chartTypeSelector.value = this.chartType || "table";
    }
  },
};
