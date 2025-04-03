document.getElementById("promptInput").addEventListener("keypress", async (event) => {
  if (event.key === "Enter") {
    await sendPrompt();
  }
});

document.querySelector("button").addEventListener("click", sendPrompt);

async function sendPrompt() {
  const promptValue = document.getElementById("promptInput").value;
  const container = document.getElementById("tableContainer");

  try {
    const result = await fetchData(promptValue);
    const {
      aggregation_definition: { fields },
      dataset,
    } = result;
    visualizeData(container, fields, dataset);
  } catch (error) {
    container.textContent = error.message;
  }
}
