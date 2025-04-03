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

// Function to clean up previous visualizations
function cleanupVisualization(container) {
  // Clean up grid instance if it exists
  if (currentGridInstance) {
    currentGridInstance.destroy();
    currentGridInstance = null;
  }

  // Clean up chart if it exists
  if (currentChart) {
    container.removeChild(currentChart);
    currentChart = null;
  }

  // Clear any other content
  container.innerHTML = "";
}

// Function to render a table using gridjs
function renderTable(dataset, container) {
  const fields = Object.keys(dataset[0]);
  currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: { limit: 50 },
  }).render(container);
}

// Bar Chart
function renderBarChart(dataset, container) {
  // Clear any previous content in the container.
  container.innerHTML = "";

  // Determine pagination parameters.
  const pageSize = 20;
  const page = state.barChartPage || 0;
  const totalPages = Math.ceil(dataset.length / pageSize);
  const pageData = dataset.slice(page * pageSize, (page + 1) * pageSize);

  // Find the first property with a string value (used as category)
  // and the first property with a number value (used as measure).
  const dimension = Object.keys(dataset[0]).find((key) => typeof dataset[0][key] === "string");
  const measure = Object.keys(dataset[0]).find((key) => typeof dataset[0][key] === "number");
  if (!dimension || !measure) {
    container.innerHTML = "<p>Cannot create bar chart: missing dimension or measure</p>";
    return;
  }

  // Set the dimensions and margins of the chart.
  const width = 1200;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 20, left: 200 };

  // Create an SVG element using D3.
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  // Create a linear scale for the measure (x-axis).
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(pageData, (d) => d[measure])])
    .nice()
    .range([margin.left, width - margin.right]);

  // Create a band scale for the dimension (y-axis).
  // Using row indices ensures that each bar gets unique positioning.
  const y = d3
    .scaleBand()
    .domain(d3.range(pageData.length))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);

  // Draw each horizontal bar.
  svg
    .selectAll("rect")
    .data(pageData)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d, i) => y(i))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "steelblue");

  // Draw the x-axis and position it at the bottom of the chart.
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  // Draw the y-axis and use the dimension values as labels.
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .tickFormat((d, i) => pageData[i][dimension])
        .tickSize(0)
    );

  // Create simple pagination controls ("Previous" and "Next" buttons).
  const paginationDiv = document.createElement("div");
  paginationDiv.style.marginTop = "5px";

  // Create and hook up the "Previous" button.
  const prevButton = document.createElement("button");
  prevButton.textContent = "Previous";
  prevButton.disabled = page <= 0;
  prevButton.addEventListener("click", () => {
    state.barChartPage = page - 1;
    renderBarChart(dataset, container);
  });

  // Create and hook up the "Next" button.
  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.disabled = page >= totalPages - 1;
  nextButton.addEventListener("click", () => {
    state.barChartPage = page + 1;
    renderBarChart(dataset, container);
  });

  // Display the current page number.
  const pageInfo = document.createElement("span");
  pageInfo.textContent = ` Page ${page + 1} of ${totalPages} `;

  // Append the buttons and page info into the pagination container.
  paginationDiv.appendChild(prevButton);
  paginationDiv.appendChild(pageInfo);
  paginationDiv.appendChild(nextButton);

  // Append the pagination controls below the chart.
  container.appendChild(paginationDiv);
}

// Placeholder for a simple line chart
function renderLineChart(dataset, container) {
  container.innerHTML =
    "<p>Line chart visualization would appear here.</p>" +
    "<pre>" +
    JSON.stringify(dataset.slice(0, 3), null, 2) +
    "...</pre>";
}
