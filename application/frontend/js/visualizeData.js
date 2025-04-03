// Visualize data in the specified container using Grid.js
function visualizeData(container, fields, dataset) {
  // Clear the container before rendering
  container.innerHTML = "";

  // Initialize and render the Grid.js table
  gridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
  }).render(container);
}

export default visualizeData;
