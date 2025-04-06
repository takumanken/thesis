import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

// Main function that orchestrates the rendering process
function renderBarChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";
  const dimension = state.aggregationDefinition.dimensions[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  const config = setupConfig(dataset.length);

  // Create chart structure and get references
  const { chartContainer, xAxisDiv, scrollDiv, svg, xAxisSvg } = setupChartStructure(
    container,
    config.width,
    config.totalHeight,
    config.margin,
    config.fullChartHeight
  );

  // Create scales
  const scales = createScales(dataset, measure, config.margin, config.width, config.fullChartHeight);

  // Draw elements
  drawBars(svg, dataset, scales.x, scales.y, measure, config.margin);
  addBarLabels(svg, dataset, scales.x, scales.y, measure);
  addYAxis(svg, scales.y, dataset, dimension, config.margin);
  addXAxis(xAxisSvg, scales.x, config.margin);
}

// Setup configuration values
function setupConfig(dataLength) {
  const width = CHART_DIMENSIONS.width;
  const totalHeight = CHART_DIMENSIONS.height;
  const margin = { top: 40, right: 20, bottom: 20, left: 200 };
  const barHeight = 25;
  const fullChartHeight = margin.top + margin.bottom + barHeight * dataLength;

  return { width, totalHeight, margin, barHeight, fullChartHeight };
}

// Create the DOM structure for the chart
function setupChartStructure(container, width, totalHeight, margin, fullChartHeight) {
  // Create a container div to hold both fixed x-axis and scrollable chart
  const chartContainer = document.createElement("div");
  chartContainer.style.position = "relative";
  chartContainer.style.width = width + "px";
  chartContainer.style.height = totalHeight + "px";
  container.appendChild(chartContainer);

  // Create a fixed div for the x-axis
  const xAxisDiv = document.createElement("div");
  xAxisDiv.style.position = "absolute";
  xAxisDiv.style.top = "0px";
  xAxisDiv.style.left = "0px";
  xAxisDiv.style.width = "100%";
  xAxisDiv.style.height = margin.top + "px";
  chartContainer.appendChild(xAxisDiv);

  // Create a scrollable container for the bars and y-axis
  const scrollDiv = document.createElement("div");
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = margin.top + "px";
  scrollDiv.style.left = "0px";
  scrollDiv.style.width = "100%";
  scrollDiv.style.height = totalHeight - margin.top + "px";
  scrollDiv.style.overflowY = "auto";
  chartContainer.appendChild(scrollDiv);

  // Append SVGs
  const svg = d3
    .select(scrollDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", fullChartHeight - margin.top);

  const xAxisSvg = d3.select(xAxisDiv).append("svg").attr("width", width).attr("height", margin.top);

  return { chartContainer, xAxisDiv, scrollDiv, svg, xAxisSvg };
}

// Create scales for the chart
function createScales(dataset, measure, margin, width, fullChartHeight) {
  // X scale based on the measure values
  const xMax = d3.max(dataset, (d) => d[measure]);
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([margin.left, width - margin.right])
    .nice();

  // Y scale for the bars
  const y = d3
    .scaleBand()
    .domain(d3.range(dataset.length))
    .range([0, fullChartHeight - margin.top - margin.bottom])
    .padding(0.1);

  return { x, y };
}

// Draw the bars
function drawBars(svg, dataset, x, y, measure, margin) {
  svg
    .selectAll("rect")
    .data(dataset)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d, i) => y(i))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "steelblue");
}

// Add labels to the bars
function addBarLabels(svg, dataset, x, y, measure) {
  svg
    .selectAll("text.bar-label")
    .data(dataset)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(d[measure]) + 5)
    .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .attr("fill", "black")
    .text((d) => d[measure]);
}

// Add the y-axis
function addYAxis(svg, y, dataset, dimension, margin) {
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .tickFormat((d, i) => dataset[i][dimension])
        .tickSize(0)
    );
}

// Add the x-axis
function addXAxis(xAxisSvg, x, margin) {
  xAxisSvg
    .append("g")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(x));
}

export default renderBarChart;
