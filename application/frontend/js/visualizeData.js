function visualizeData(container, dataset) {
  container.innerHTML = "";
  const fields = Object.keys(dataset[0]);

  gridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
  }).render(container);
}

export default visualizeData;
