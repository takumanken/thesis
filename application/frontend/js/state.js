export const state = {
  userQuery: "",
  dataset: [],
  sql: "",
  aggregationDefinition: {},
  chartType: "table",
  availableChartTypes: ["table"],
  // Function to update the state – it uses Object.assign to copy properties.
  update(newData) {
    Object.assign(this, newData);

    const chartTypeSelector = document.getElementById("chartTypeSelector");
    if (chartTypeSelector) {
      chartTypeSelector.value = this.chartType || "table";
    }
  },
};
