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
    case "map":
      renderMap(container);
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

// -----------------------------
// Render Table
// -----------------------------
function renderTable(container) {
  const dataset = state.dataset;
  const fields = Object.keys(dataset[0]);
  currentGridInstance = new gridjs.Grid({
    columns: fields,
    data: dataset,
    pagination: { limit: 50 },
  }).render(container);
}

// -----------------------------
// Render Horizontal Bar Chart
// -----------------------------
function renderBarChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";

  let dimension = state.aggregationDefinition.dimensions[0];
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

// -----------------------------
// Render Line Chart
// -----------------------------
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

// -----------------------------
// Render Map (Heatmap)
// -----------------------------
function renderMap(container) {
  const dataset = state.dataset;
  const geoDim = state.aggregationDefinition.geo_dimension[0]; // e.g., "borough" or "neighborhood_name"
  const measure = state.aggregationDefinition.measures[0].alias;

  // Only support geo map for borough or neighborhood_name
  if (!(geoDim === "borough" || geoDim === "neighborhood_name")) {
    container.innerHTML = `<p>Geo dimension "${geoDim}" is not supported for map visualization.</p>`;
    return;
  }

  // Create a mapping from region to measure value.
  // Convert dataset values to upper case if geo dimension is "borough".
  const aggregatedData = {};
  dataset.forEach((d) => {
    const region = geoDim === "borough" ? d[geoDim].toUpperCase() : d[geoDim];
    if (region && region !== "Unspecified" && !aggregatedData.hasOwnProperty(region)) {
      aggregatedData[region] = +d[measure];
    }
  });

  // Determine the maximum value for the color scale.
  const maxVal = d3.max(Object.values(aggregatedData));
  const colorScale = d3.scaleSequential(d3.interpolateOrRd).domain([0, maxVal]);

  // Define dimensions and create SVG container.
  const width = CHART_DIMENSIONS.width || 800;
  const height = CHART_DIMENSIONS.height || 600;
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  // Load the geojson file only for "borough" and "neighborhood_name"
  d3.json("assets/geojson/2020_nyc_neighborhood_tabulation_areas_nta.geojson").then((geojsonData) => {
    // Set up a projection and path generator.
    const projection = d3.geoMercator().fitSize([width, height], geojsonData);
    const path = d3.geoPath().projection(projection);

    // For each feature, attach the measure value from aggregatedData.
    geojsonData.features.forEach((feature) => {
      let regionName;
      if (geoDim === "borough") {
        regionName = feature.properties.boroname.toUpperCase();
      } else if (geoDim === "neighborhood_name") {
        regionName = feature.properties.ntaname;
      }
      feature.properties.aggValue = regionName && regionName !== "UNSPECIFIED" ? aggregatedData[regionName] || 0 : 0;
    });

    // Draw the map.
    svg
      .selectAll("path")
      .data(geojsonData.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", (d) => colorScale(d.properties.aggValue))
      .attr("stroke-width", 0.5);

    // Add a tooltip on mouseover.
    svg
      .selectAll("path")
      .on("mouseover", function (event, d) {
        const tooltip = d3
          .select(container)
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "#fff")
          .style("padding", "5px")
          .style("border", "1px solid #000").html(`<strong>${
          geoDim === "borough" ? d.properties.boroname : d.properties.ntaname
        }</strong><br>
                 <strong>${measure}:</strong> ${d.properties.aggValue}`);
        tooltip.style("left", event.pageX + 5 + "px").style("top", event.pageY + 5 + "px");
      })
      .on("mouseout", function () {
        d3.select(container).select(".tooltip").remove();
      });

    // Add legend.
    // Define legend dimensions.
    const legendWidth = 300;
    const legendHeight = 10;
    const legendX = width - legendWidth - 20;
    const legendY = height - 40;

    // Append group for legend.
    const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${legendX}, ${legendY})`);

    // Define gradient.
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(0));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(maxVal));

    // Draw legend rectangle filled with gradient.
    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    // Create legend scale.
    const legendScale = d3.scaleLinear().domain([0, maxVal]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(5);

    legend.append("g").attr("transform", `translate(0, ${legendHeight})`).call(legendAxis);
  });
}

export { renderLineChart };
export { renderMap };
