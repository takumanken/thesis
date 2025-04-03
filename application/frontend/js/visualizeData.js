function visualizeData(container, fields, dataset) {
  container.innerHTML = "";

  gridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
  }).render(container);
}

export default visualizeData;
