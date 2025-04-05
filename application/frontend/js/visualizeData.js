import { state } from "./state.js";
import { CHART_DIMENSIONS, BAR_CHART_PAGE_SIZE } from "./constants.js";

let currentGridInstance = null;
let currentChart = null;

// ------------------------------
// Main Function
// ------------------------------

function visualizeData() {
  const { chartType } = state;
  const container = document.getElementById("tableContainer");

  // Clean up previous visualizations
  cleanupVisualization(container);

  // Render based on selected chart type
  switch (chartType) {
    case "table":
      renderTable(container);
      break;
    case "bar_chart":
      renderBarChart(container);
      break;
    case "line_chart":
      renderLineChart(container);
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
function renderTable(container) {
  const dataset = state.dataset;
  const fields = Object.keys(dataset[0]);
  currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: { limit: 50 },
  }).render(container);
}

// Render a horizontal bar chart with pagination (20 items per page) using D3.
function renderBarChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";

  let dimension = state.aggregationDefinition.categorical_dimension[0];
  let measure = state.aggregationDefinition.measures[0].alias;

  // Pagination Setup
  const pageSize = BAR_CHART_PAGE_SIZE;
  const page = state.barChartPage || 0;
  const totalPages = Math.ceil(dataset.length / pageSize);
  const pageData = dataset.slice(page * pageSize, (page + 1) * pageSize);

  const width = CHART_DIMENSIONS.width;
  const height = CHART_DIMENSIONS.height;
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

  // Pagination controls.
  const paginationDiv = document.createElement("div");
  paginationDiv.style.marginTop = "5px";

  const prevButton = document.createElement("button");
  prevButton.textContent = "Previous";
  prevButton.disabled = page <= 0;
  prevButton.addEventListener("click", () => {
    state.barChartPage = page - 1;
    renderBarChart(container);
  });

  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.disabled = page >= totalPages - 1;
  nextButton.addEventListener("click", () => {
    state.barChartPage = page + 1;
    renderBarChart(container);
  });

  const pageInfo = document.createElement("span");
  pageInfo.textContent = ` Page ${page + 1} of ${totalPages} `;

  paginationDiv.appendChild(prevButton);
  paginationDiv.appendChild(pageInfo);
  paginationDiv.appendChild(nextButton);
  container.appendChild(paginationDiv);
}

// Render a line chart
function renderLineChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";

  // Retrieve required definitions from aggregationDefinition.
  const timeDimension = state.aggregationDefinition.time_dimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  const categoricalDimension =
    state.aggregationDefinition.categorical_dimension && state.aggregationDefinition.categorical_dimension.length > 0
      ? state.aggregationDefinition.categorical_dimension[0]
      : null;

  // Create a local copy with parsed time.
  const parseTime = d3.timeParse("%Y-%m-%d");
  const data = dataset.map((d) => ({
    ...d,
    parsedTime: parseTime(d[timeDimension]),
  }));

  // Set up SVG canvas.
  const margin = { top: 20, right: 20, bottom: 70, left: 70 };
  const width = CHART_DIMENSIONS.width - margin.left - margin.right;
  const height = CHART_DIMENSIONS.height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Set up scales.
  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.parsedTime))
    .range([0, width]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[measure])])
    .range([height, 0]);

  // Define a line generator.
  const lineGenerator = d3
    .line()
    .x((d) => x(d.parsedTime))
    .y((d) => y(d[measure]));

  if (categoricalDimension) {
    // Group data by the categorical dimension.
    const groupedData = d3.group(data, (d) => d[categoricalDimension]);
    // Create a color scale.
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(Array.from(groupedData.keys()));

    // For each group, draw a line.
    groupedData.forEach((values, key) => {
      svg
        .append("path")
        .datum(values)
        .attr("fill", "none")
        .attr("stroke", color(key))
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);
    });

    // Optionally, add legend.
    const legend = svg
      .selectAll(".legend")
      .data(Array.from(groupedData.keys()))
      .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(0,${i * 20})`);

    legend
      .append("rect")
      .attr("x", width - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", color);

    legend
      .append("text")
      .attr("x", width - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text((d) => d);
  } else {
    // Draw a single line.
    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", lineGenerator);
  }

  // Add the X axis.
  const xAxis = d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d"));
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis)
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // Add the Y axis.
  svg.append("g").call(d3.axisLeft(y));
}

export { renderLineChart };
