let gridInstance = null;

async function sendPrompt() {
  const promptValue = document.getElementById("promptInput").value;

  const response = await fetch("https://thesis-production-65a4.up.railway.app/process", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: promptValue }),
  });

  if (response.ok) {
    const result = await response.json();
    console.log(result);
    const aggregationDefinition = result.aggregation_definition;
    const dataset = result.dataset;
    const fields = aggregationDefinition.fields;

    const container = document.getElementById("tableContainer");

    // If the grid already exists, update its config; otherwise, create a new grid
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
  } else {
    document.getElementById("tableContainer").textContent = "Error: " + response.status;
  }
}
