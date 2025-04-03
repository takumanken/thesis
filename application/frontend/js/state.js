export const state = {
  // State variables
  chartType: null,
  dataset: [],
  userQuery: "",
  aggregationDefinition: {},
  sql: "",

  // Function to update the state
  update(newData) {
    Object.assign(this, newData);

    // Update the chart type selector in the UI
    const chartTypeSelector = document.getElementById("chartTypeSelector");
    if (chartTypeSelector) {
      chartTypeSelector.value = this.chartType || "table";
    }
  },
};
