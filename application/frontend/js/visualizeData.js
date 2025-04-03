import { state } from "./state.js";

let currentGridInstance = null;
let currentChart = null;

// ------------------------------
// Main Function
// ------------------------------

function visualizeData() {
  const { dataset, chartType } = state;
  const container = document.getElementById("tableContainer");
  document.getElementById("chartTypeSelector").value = state.chartType || "table";

  // Clean up previous visualizations
  cleanupVisualization(container);

  // Check if dataset is available
  if (!dataset || !dataset.length) {
    container.innerHTML = "<p>No data available</p>";
    return;
  }

  // Render based on selected chart type
  switch (chartType) {
    case "table":
      renderTable(dataset, container);
      break;
    case "bar_chart":
      renderBarChart(dataset, container);
      break;
    case "line_chart":
      renderLineChart(dataset, container);
      break;
    default:
      container.innerHTML = `<p>Chart type "${chartType}" is not supported.</p>`;
  }
}

export default visualizeData;

// -----------------------------
// Helper Functions
// -----------------------------

// Clean up previous visualizations in the container.
function cleanupVisualization(container) {
  if (currentGridInstance) {
    currentGridInstance.destroy();
    currentGridInstance = null;
  }
  if (currentChart) {
    container.removeChild(currentChart);
    currentChart = null;
  }
  container.innerHTML = "";
}

// Render a table using gridjs.
function renderTable(dataset, container) {
  const fields = Object.keys(dataset[0]);
  currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: { limit: 50 },
  }).render(container);
}

// Render a horizontal bar chart with pagination (20 items per page) using D3.
function renderBarChart(dataset, container) {
  container.innerHTML = "";

  const pageSize = 20;
  const page = state.barChartPage || 0;
  const totalPages = Math.ceil(dataset.length / pageSize);
  const pageData = dataset.slice(page * pageSize, (page + 1) * pageSize);

  const dimension = Object.keys(dataset[0]).find((key) => typeof dataset[0][key] === "string");
  const measure = Object.keys(dataset[0]).find((key) => typeof dataset[0][key] === "number");
  if (!dimension || !measure) {
    container.innerHTML = "<p>Cannot create bar chart: missing dimension or measure</p>";
    return;
  }

  const width = 1200,
    height = 600;
  const margin = { top: 20, right: 20, bottom: 20, left: 200 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(pageData, (d) => d[measure])])
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleBand()
    .domain(d3.range(pageData.length))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);

  svg
    .selectAll("rect")
    .data(pageData)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d, i) => y(i))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "steelblue");

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .tickFormat((d, i) => pageData[i][dimension])
        .tickSize(0)
    );

  const paginationDiv = document.createElement("div");
  paginationDiv.style.marginTop = "5px";

  const prevButton = document.createElement("button");
  prevButton.textContent = "Previous";
  prevButton.disabled = page <= 0;
  prevButton.addEventListener("click", () => {
    state.barChartPage = page - 1;
    renderBarChart(dataset, container);
  });

  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.disabled = page >= totalPages - 1;
  nextButton.addEventListener("click", () => {
    state.barChartPage = page + 1;
    renderBarChart(dataset, container);
  });

  const pageInfo = document.createElement("span");
  pageInfo.textContent = ` Page ${page + 1} of ${totalPages} `;

  paginationDiv.appendChild(prevButton);
  paginationDiv.appendChild(pageInfo);
  paginationDiv.appendChild(nextButton);
  container.appendChild(paginationDiv);
}

// Render a placeholder for a line chart.
function renderLineChart(dataset, container) {
  container.innerHTML =
    "<p>Line chart visualization would appear here.</p>" +
    "<pre>" +
    JSON.stringify(dataset.slice(0, 3), null, 2) +
    "...</pre>";
}
