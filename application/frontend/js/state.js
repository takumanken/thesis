export const state = {
  userQuery: "",
  dataset: [],
  fields: [],
  sql: "",
  aggregationDefinition: {},
  chartType: "table",
  availableChartTypes: ["table"],
  textResponse: null, // Add this field

  // Update method
  update(newData) {
    this.userQuery = newData.userQuery || this.userQuery;
    this.dataset = newData.dataset || [];
    this.fields = newData.fields || [];
    this.sql = newData.sql || "";
    this.aggregationDefinition = newData.aggregationDefinition || {};
    this.chartType = newData.chartType || "table";
    this.availableChartTypes = newData.availableChartTypes || ["table"];
    this.textResponse = newData.textResponse || null; // Include text response in update

    const chartTypeSelector = document.getElementById("chartTypeSelector");
    if (chartTypeSelector) {
      chartTypeSelector.value = this.chartType || "table";
    }
  },
};
