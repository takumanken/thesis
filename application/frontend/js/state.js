export const state = {
  userQuery: "",
  dataset: [],
  sql: "",
  aggregationDefinition: {},
  chartType: "table",
  availableChartTypes: ["table"],
  textResponse: null,

  // Update method keeps consistent structure
  update(data) {
    this.dataset = data.dataset || [];
    this.fields = data.fields || [];
    this.aggregationDefinition = data.aggregation_definition || {};
    this.sql = data.sql || "";
    this.chartType = data.chartType || "table";
    this.availableChartTypes = data.availableChartTypes || ["table"];
    this.textResponse = data.textResponse || null;
  },
};
