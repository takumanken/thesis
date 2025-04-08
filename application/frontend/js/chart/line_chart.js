import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderLineChart(container) {
  // Clear container and extract data
  container.innerHTML = "";
  const dataset = state.dataset;

  // Extract dimensions and measure
  const { timeDimension, measure, groupDimension } = extractDimensions();

  // Prepare data
  const data = prepareData(dataset, timeDimension);

  // Set up chart
  const { margin, width, height, svg } = setupChart(container);

  // Create scales
  const { x, y } = createScales(data, measure, width, height);

  // Create line generator
  const lineGenerator = createLineGenerator(x, y, measure);

  // Draw lines based on grouping
  if (groupDimension) {
    drawGroupedLines(svg, data, groupDimension, lineGenerator, width);
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
  const width = CHART_DIMENSIONS.width - margin.left - margin.right;
  const height = CHART_DIMENSIONS.height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
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

// Draw lines for grouped data
function drawGroupedLines(svg, data, groupDimension, lineGenerator, width) {
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

  // Create legend for groups
  createLegend(svg, groupedData, color, width);
}

// Create legend for the grouped lines
function createLegend(svg, groupedData, color, width) {
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
