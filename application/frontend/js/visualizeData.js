let gridInstance = null;

function visualizeData(container, fields, dataset) {
  if (gridInstance) {
    gridInstance
      .updateConfig({
        columns: fields,
        data: dataset,
      })
      .forceRender();
  } else {
    gridInstance = new gridjs.Grid({
      columns: fields,
      data: dataset,
    });
    gridInstance.render(container);
  }
}
