import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { createLegend } from "./utils/legendUtil.js";

function renderLineChart(container) {
  // Clear container and extract data
  container.innerHTML = "";
  const dataset = state.dataset;

  // Extract dimensions and measure
  const { timeDimension, measure, groupDimension } = extractDimensions();

  // Prepare data
  const data = prepareData(dataset, timeDimension);

  // Set up chart
  let chartArea = container;

  // If we have grouping, create legend first
  if (groupDimension) {
    const groupedData = d3.group(data, (d) => d[groupDimension]);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(Array.from(groupedData.keys()));
    const legendResult = createLegend(container, Array.from(groupedData.keys()), color);
    chartArea = legendResult.chartArea;
  }

  const { margin, width, height, svg } = setupChart(chartArea);

  // Create scales
  const { x, y } = createScales(data, measure, width, height);

  // Create line generator
  const lineGenerator = createLineGenerator(x, y, measure);

  // Draw lines based on grouping
  if (groupDimension) {
    // We've already created the legend, just draw the lines
    drawGroupedLinesNoLegend(svg, data, groupDimension, lineGenerator);
  } else {
    drawSingleLine(svg, data, lineGenerator);
  }

  // Add axes
  addXAxis(svg, x, height);
  addYAxis(svg, y);
}

// Extract dimensions and measure from state
function extractDimensions() {
  const timeDimension = state.aggregationDefinition.timeDimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Look for an additional grouping dimension (either categorical or geo)
  let groupDimension = null;
  if (state.aggregationDefinition.categoricalDimension && state.aggregationDefinition.categoricalDimension.length > 0) {
    groupDimension = state.aggregationDefinition.categoricalDimension[0];
  } else if (state.aggregationDefinition.geoDimension && state.aggregationDefinition.geoDimension.length > 0) {
    groupDimension = state.aggregationDefinition.geoDimension[0];
  }

  return { timeDimension, measure, groupDimension };
}

// Parse time data and filter invalid records
function prepareData(dataset, timeDimension) {
  const parseTime = d3.timeParse("%Y-%m-%d");
  return dataset.map((d) => ({ ...d, parsedTime: parseTime(d[timeDimension]) })).filter((d) => d.parsedTime);
}

// Set up chart container and SVG
function setupChart(container) {
  const margin = { top: 20, right: 20, bottom: 70, left: 70 };

  // Since container might be the original container or the chartArea,
  // adjust the width for the chartArea case
  const isChartArea = container.className === "chart-area";
  const width = (isChartArea ? CHART_DIMENSIONS.width * 0.8 : CHART_DIMENSIONS.width) - margin.left - margin.right;
  const height = CHART_DIMENSIONS.height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return { margin, width, height, svg };
}

// Create x and y scales for the chart
function createScales(data, measure, width, height) {
  // X scale uses the full time extent
  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.parsedTime))
    .range([0, width]);

  // Y scale for the measure values
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[measure])])
    .range([height, 0]);

  return { x, y };
}

// Create line generator function
function createLineGenerator(x, y, measure) {
  return d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => x(d.parsedTime))
    .y((d) => y(d[measure]));
}

// Draw lines for grouped data without legend creation
function drawGroupedLinesNoLegend(svg, data, groupDimension, lineGenerator) {
  // Group data according to the additional dimension
  const groupedData = d3.group(data, (d) => d[groupDimension]);
  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(Array.from(groupedData.keys()));

  // For each group, sort the values by parsedTime and draw a line
  groupedData.forEach((values, key) => {
    const validValues = values.sort((a, b) => a.parsedTime - b.parsedTime);
    svg
      .append("path")
      .datum(validValues)
      .attr("fill", "none")
      .attr("stroke", color(key))
      .attr("stroke-width", 2)
      .attr("d", lineGenerator);
  });
}

// Draw a single line for non-grouped data
function drawSingleLine(svg, data, lineGenerator) {
  svg
    .append("path")
    .datum(data.sort((a, b) => a.parsedTime - b.parsedTime))
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", lineGenerator);
}

// Add x-axis to the chart
function addXAxis(svg, x, height) {
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d")))
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");
}

// Add y-axis to the chart
function addYAxis(svg, y) {
  svg.append("g").call(d3.axisLeft(y));
}

export default renderLineChart;
