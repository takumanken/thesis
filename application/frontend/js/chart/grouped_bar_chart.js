import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderGroupedBarChart(container) {
  // Initialize and create UI elements
  setupSwapButton(container);

  const dataset = state.dataset;

  // Extract and process dimensions
  const { groupKey, subGroupKey, measure } = extractDimensions(container);

  // Compute sorted groups and subgroups
  const { sortedGroups, sortedSubGroups } = computeSortedGroups(dataset, groupKey, subGroupKey, measure);

  // Setup chart parameters
  const config = setupConfig();

  // Create scales for the chart
  const scales = createScales(sortedGroups, sortedSubGroups, dataset, measure, config);

  // Setup chart structure and get references
  const { chartContainer, xAxisDiv, scrollDiv, svg, xAxisSvg } = setupChartStructure(
    container,
    config.width,
    config.totalHeight,
    config.margin,
    config.fullChartHeight
  );

  // Create color scale and tooltip
  const color = createColorScale(sortedSubGroups);
  const tooltip = createTooltip(container);

  // Draw the chart elements
  drawBars(
    svg,
    dataset,
    scales.outerY,
    scales.innerY,
    scales.x,
    config.margin,
    groupKey,
    subGroupKey,
    measure,
    color,
    tooltip
  );

  // Add axes and legend
  addYAxis(svg, scales.outerY, config.margin);
  addXAxis(xAxisSvg, scales.x, config.margin);
  addLegend(svg, sortedSubGroups, color, config.width, config.margin, config.fullChartHeight);
}

function setupSwapButton(container) {
  // Initialize local swap flag on container
  if (container.swapDimensions === undefined) {
    container.swapDimensions = false;
  }

  // Clear previous content
  container.innerHTML = "";

  // Create and append a swap button
  const swapBtn = document.createElement("button");
  swapBtn.textContent = "Swap Dimensions";
  swapBtn.style.marginBottom = "10px";
  swapBtn.addEventListener("click", () => {
    container.swapDimensions = !container.swapDimensions;
    renderGroupedBarChart(container);
  });
  container.appendChild(swapBtn);
}

function extractDimensions(container) {
  // Extract dimensions from state
  let groupKey = state.aggregationDefinition.dimensions[0]; // e.g. "neighborhood"
  let subGroupKey = state.aggregationDefinition.dimensions[1]; // e.g. "complaint_type_large"

  // Swap dimensions if flag is on
  if (container.swapDimensions) {
    [groupKey, subGroupKey] = [subGroupKey, groupKey];
  }

  const measure = state.aggregationDefinition.measures[0].alias; // e.g. "num_of_requests"

  return { groupKey, subGroupKey, measure };
}

function setupConfig() {
  const width = CHART_DIMENSIONS.width;
  const totalHeight = CHART_DIMENSIONS.height;
  // Reserve top margin for fixed x-axis
  const margin = { top: 40, right: 20, bottom: 20, left: 200 };
  const fullChartHeight = margin.top + margin.bottom + (totalHeight - margin.top - margin.bottom);

  return { width, totalHeight, margin, fullChartHeight };
}

function computeSortedGroups(dataset, groupKey, subGroupKey, measure) {
  // Compute sorted unique groups based on total measure (desc)
  const groupSums = d3.rollup(
    dataset,
    (v) => d3.sum(v, (d) => d[measure]),
    (d) => d[groupKey]
  );

  const sortedGroups = Array.from(groupSums, ([key, sum]) => ({ key, sum }))
    .sort((a, b) => d3.descending(a.sum, b.sum))
    .map((d) => d.key);

  // Compute sorted unique subgroups based on total measure (desc) - global ordering
  const subGroupSums = d3.rollup(
    dataset,
    (v) => d3.sum(v, (d) => d[measure]),
    (d) => d[subGroupKey]
  );

  const sortedSubGroups = Array.from(subGroupSums, ([key, sum]) => ({ key, sum }))
    .sort((a, b) => d3.descending(a.sum, b.sum))
    .map((d) => d.key);

  return { sortedGroups, sortedSubGroups };
}

function createScales(sortedGroups, sortedSubGroups, dataset, measure, config) {
  // Outer y-scale for groups
  const outerY = d3
    .scaleBand()
    .domain(sortedGroups)
    .range([0, config.totalHeight - config.margin.top - config.margin.bottom])
    .padding(0.2);

  // Inner y-scale for subgroups within each group
  const innerY = d3.scaleBand().domain(sortedSubGroups).range([0, outerY.bandwidth()]).padding(0.1);

  // X scale based on measure values
  const xMax = d3.max(dataset, (d) => d[measure]);
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([config.margin.left, config.width - config.margin.right])
    .nice();

  return { outerY, innerY, x };
}

function setupChartStructure(container, width, totalHeight, margin, fullChartHeight) {
  // Create the main container that holds both fixed x-axis and a scrollable area
  const chartContainer = document.createElement("div");
  chartContainer.style.position = "relative";
  chartContainer.style.width = width + "px";
  chartContainer.style.height = totalHeight + "px";
  container.appendChild(chartContainer);

  // Create fixed container for the x-axis
  const xAxisDiv = document.createElement("div");
  xAxisDiv.style.position = "absolute";
  xAxisDiv.style.top = "0px";
  xAxisDiv.style.left = "0px";
  xAxisDiv.style.width = "100%";
  xAxisDiv.style.height = margin.top + "px";
  chartContainer.appendChild(xAxisDiv);

  // Create scrollable container for the bars and y-axis
  const scrollDiv = document.createElement("div");
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = margin.top + "px";
  scrollDiv.style.left = "0px";
  scrollDiv.style.width = "100%";
  scrollDiv.style.height = totalHeight - margin.top + "px";
  scrollDiv.style.overflowY = "auto";
  chartContainer.appendChild(scrollDiv);

  // Append an SVG to the scrollable container
  const svg = d3
    .select(scrollDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", fullChartHeight - margin.top);

  // Create an SVG for the fixed x-axis
  const xAxisSvg = d3.select(xAxisDiv).append("svg").attr("width", width).attr("height", margin.top);

  return { chartContainer, xAxisDiv, scrollDiv, svg, xAxisSvg };
}

function createColorScale(sortedSubGroups) {
  return d3.scaleOrdinal(d3.schemeCategory10).domain(sortedSubGroups);
}

function createTooltip(container) {
  return d3
    .select(container)
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "#fff")
    .style("padding", "5px")
    .style("border", "1px solid #ccc")
    .style("display", "none");
}

function drawBars(svg, dataset, outerY, innerY, x, margin, groupKey, subGroupKey, measure, color, tooltip) {
  svg
    .selectAll("rect")
    .data(dataset)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d) => outerY(d[groupKey]) + innerY(d[subGroupKey]))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", innerY.bandwidth())
    .attr("fill", (d) => color(d[subGroupKey]))
    .on("mouseover", function (event, d) {
      tooltip
        .style("display", "block")
        .html(`${groupKey}: ${d[groupKey]}<br>${subGroupKey}: ${d[subGroupKey]}<br>${measure}: ${d[measure]}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mousemove", function (event) {
      tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });
}

function addYAxis(svg, outerY, margin) {
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(outerY).tickSize(0));
}

function addXAxis(xAxisSvg, x, margin) {
  xAxisSvg
    .append("g")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(x));
}

function addLegend(svg, sortedSubGroups, color, width, margin, fullChartHeight) {
  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", () => {
      const legendHeight = sortedSubGroups.length * 20; // row height of 20
      return `translate(${width - margin.right - 120}, ${fullChartHeight - margin.top - legendHeight - 10})`;
    });

  sortedSubGroups.forEach((d, i) => {
    const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
    legendRow.append("rect").attr("width", 18).attr("height", 18).attr("fill", color(d));
    legendRow.append("text").attr("x", -5).attr("y", 9).attr("dy", "0.35em").attr("text-anchor", "end").text(d);
  });
}

export default renderGroupedBarChart;
