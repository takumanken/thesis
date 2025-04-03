import { handleUserQuery } from "./main.js";
import { state } from "./state.js";
import visualizeData from "./visualizeData.js";

function initializeEventListeners() {
  document.getElementById("promptInput").addEventListener("keypress", (event) => {
    if (event.key === "Enter") handleUserQuery();
  });

  document.querySelector("button").addEventListener("click", handleUserQuery);

  document.getElementById("chartTypeSelector").addEventListener("change", (event) => {
    state.chartType = event.target.value;
    visualizeData();
  });
}

export default initializeEventListeners;
