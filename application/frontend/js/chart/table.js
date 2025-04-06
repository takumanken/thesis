import { state } from "../state.js";

function renderTable(container) {
  const dataset = state.dataset;
  const fields = Object.keys(dataset[0]);
  state.currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: { limit: 50 },
  }).render(container);
}

export default renderTable;
