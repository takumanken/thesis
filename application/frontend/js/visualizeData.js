let currentGridInstance = null;

function visualizeData(dataset) {
  const container = document.getElementById("tableContainer");

  if (currentGridInstance) {
    try {
      currentGridInstance.destroy();
    } catch (e) {
      console.warn("Error cleaning up previous grid:", e);
    }
    currentGridInstance = null;
  }
  container.innerHTML = "";

  try {
    const fields = Object.keys(dataset[0]);

    currentGridInstance = new gridjs.Grid({
      columns: fields,
      data: dataset,
      pagination: {
        limit: 50,
      },
    }).render(container);
  } catch (error) {
    container.innerHTML = `<p>Error displaying data: ${error.message}</p>`;
    console.error("Error in visualizeData:", error);
  }
}

export default visualizeData;
