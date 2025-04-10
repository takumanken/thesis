import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { createLegend } from "./utils/legendUtil.js";
import { chartStyles } from "./utils/chartStyles.js"; // Import the styles

function renderGroupedBarChart(container) {
  // Initialize and create UI elements
  setupSwapButton(container);

  const dataset = state.dataset;

  // Extract and process dimensions
  const { groupKey, subGroupKey, measure } = extractDimensions(container);

  // Compute sorted groups and subgroups
  const { sortedGroups, sortedSubGroups } = computeSortedGroups(dataset, groupKey, subGroupKey, measure);

  // Create color scale
  const color = createColorScale(sortedSubGroups);

  // Create legend and get chart area
  const { chartArea } = createLegend(container, sortedSubGroups, color);

  // Setup chart parameters with group and subgroup info
  const config = setupConfig(sortedGroups, sortedSubGroups, dataset, groupKey, subGroupKey);

  // Create scales for the chart with the new parameters
  const scales = createScales(sortedGroups, sortedSubGroups, dataset, measure, config, groupKey, subGroupKey);

  // Setup chart structure and get references
  const { chartContainer, xAxisDiv, scrollDiv, svg, xAxisSvg } = setupChartStructure(
    chartArea, // Use chartArea instead of container
    config.width,
    config.totalHeight,
    config.margin,
    config.fullChartHeight
  );

  // Create tooltip
  const tooltip = createTooltip(chartArea); // Use chartArea instead of container

  // Draw the chart elements with the updated positioning
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
    tooltip,
    scales.groupPositionsArray // Use array format here
  );

  // Add axes (but no legend)
  addYAxis(svg, scales.outerY, sortedGroups, scales.groupPositions, config);
  addXAxis(xAxisSvg, scales.x, config.margin);
}

function setupSwapButton(container) {
  // Initialize local swap flag on container
  if (container.swapDimensions === undefined) {
    container.swapDimensions = false;
  }

  // Create swap button
  const swapBtn = document.createElement("button");
  swapBtn.textContent = "Swap Dimensions";
  swapBtn.style.marginBottom = "10px";
  swapBtn.addEventListener("click", () => {
    container.swapDimensions = !container.swapDimensions;
    renderGroupedBarChart(container);
  });

  // Clear existing content and add button
  container.innerHTML = "";
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

function setupConfig(sortedGroups, sortedSubGroups, dataset, groupKey, subGroupKey) {
  // Get base dimensions
  const baseWidth = CHART_DIMENSIONS.width;
  const totalHeight = CHART_DIMENSIONS.height;

  // Adjust width for legend if we're using the chartArea
  const width = document.querySelector(".chart-area")
    ? baseWidth * 0.8 // If using legend, use 80% of width
    : baseWidth; // Otherwise use full width

  // Reserve top margin for fixed x-axis
  const margin = { top: 40, right: 20, bottom: 20, left: 200 };

  // Set a fixed height for each subgroup bar
  const subGroupBarHeight = 10;
  const groupPadding = 20; // Space between groups

  // Calculate total chart height based on the number of subgroups in each group
  let fullChartHeight = margin.top + margin.bottom;

  // For each group, calculate its height based on the number of subgroups it contains
  const groupHeights = {};
  sortedGroups.forEach((group) => {
    // Count how many subgroups appear in this group
    const subGroupsInThisGroup = new Set();
    dataset
      .filter((d) => d[groupKey] === group)
      .forEach((d) => {
        subGroupsInThisGroup.add(d[subGroupKey]);
      });

    const groupHeight = subGroupsInThisGroup.size * subGroupBarHeight + groupPadding;
    groupHeights[group] = groupHeight;
    fullChartHeight += groupHeight;
  });

  return {
    width,
    totalHeight,
    margin,
    subGroupBarHeight,
    groupPadding,
    groupHeights,
    fullChartHeight,
  };
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

function createScales(sortedGroups, sortedSubGroups, dataset, measure, config, groupKey, subGroupKey) {
  // Calculate positions for each group
  let currentPosition = config.margin.top;
  const groupPositions = {};
  // Create an array format for D3 to use
  const groupPositionsArray = [];

  sortedGroups.forEach((group) => {
    groupPositions[group] = currentPosition;
    // Add entry to array with proper format
    groupPositionsArray.push({
      group: group,
      position: currentPosition,
      height: config.groupHeights[group],
    });
    currentPosition += config.groupHeights[group];
  });

  // Outer y-scale for groups - custom positions based on varying heights
  const outerY = d3
    .scaleOrdinal()
    .domain(sortedGroups)
    .range(sortedGroups.map((group) => groupPositions[group]));

  // Inner y-scale for subgroups within each group
  const innerY = d3
    .scaleBand()
    .domain(sortedSubGroups)
    .range([0, d3.max(Object.values(config.groupHeights)) - config.groupPadding])
    .padding(0.1);

  // X scale based on measure values
  const xMax = d3.max(dataset, (d) => d[measure]);
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([config.margin.left, config.width - config.margin.right])
    .nice();

  return { outerY, innerY, x, groupPositions, groupPositionsArray };
}

// In setupChartStructure function of grouped_bar_chart.js
function setupChartStructure(container, width, totalHeight, margin, fullChartHeight) {
  // Create the main container
  const chartContainer = document.createElement("div");
  chartContainer.style.position = "relative";
  chartContainer.style.width = "100%";
  chartContainer.style.height = totalHeight + "px";
  container.appendChild(chartContainer);

  // Fixed header for x-axis
  const xAxisDiv = document.createElement("div");
  xAxisDiv.style.position = "absolute";
  xAxisDiv.style.top = "0";
  xAxisDiv.style.width = "100%";
  xAxisDiv.style.height = margin.top + "px";
  xAxisDiv.style.zIndex = "2";
  chartContainer.appendChild(xAxisDiv);

  // Scrollable content area - ADJUST THIS LINE:
  const scrollDiv = document.createElement("div");
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = margin.top - 1 + "px"; // Move up by 1px to remove gap
  scrollDiv.style.width = "100%";
  scrollDiv.style.height = totalHeight - margin.top + "px";
  scrollDiv.style.overflowY = "auto";
  chartContainer.appendChild(scrollDiv);

  // Rest of the function remains the same...

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

// Fix the createTooltip function to use chartStyles:
function createTooltip(container) {
  return chartStyles.createTooltip(container);
}

// Update the drawBars function to handle the array correctly:
function drawBars(
  svg,
  dataset,
  outerY,
  innerY,
  x,
  margin,
  groupKey,
  subGroupKey,
  measure,
  color,
  tooltip,
  groupPositionsArray
) {
  // Draw bars with consistent styling
  svg
    .append("g")
    .selectAll("g")
    .data(groupPositionsArray) // Use the array format
    .join("g")
    .attr("transform", (d) => `translate(0, ${d.position})`)
    .selectAll("rect")
    .data((d) => {
      const groupData = dataset.filter((item) => item[groupKey] === d.group);
      return groupData.map((item) => ({
        [groupKey]: item[groupKey],
        [subGroupKey]: item[subGroupKey],
        [measure]: item[measure],
        yPos: innerY(item[subGroupKey]),
      }));
    })
    .join("rect")
    .attr("y", (d) => d.yPos)
    .attr("x", margin.left)
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", innerY.bandwidth())
    .attr("fill", (d) => color(d[subGroupKey]))
    .on("mouseover", function (event, d) {
      chartStyles.showTooltip(
        tooltip,
        event,
        `
        <strong>${groupKey}:</strong> ${d[groupKey]}<br>
        <strong>${subGroupKey}:</strong> ${d[subGroupKey]}<br>
        <strong>${measure}:</strong> ${d[measure].toLocaleString()}
      `
      );
    })
    .on("mouseout", () => chartStyles.hideTooltip(tooltip));
}

function addYAxis(svg, outerY, sortedGroups, groupPositions, config) {
  // Add y-axis with consistent styling
  const yAxis = svg.append("g").attr("class", "y-axis").attr("transform", `translate(${config.margin.left}, 0)`);

  // Add group labels
  yAxis
    .selectAll(".group-label")
    .data(sortedGroups)
    .join("text")
    .attr("class", "group-label")
    .attr("x", -10)
    .attr("y", (d) => groupPositions[d] + config.groupHeights[d] / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .text((d) => d)
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel);

  return yAxis;
}

function addXAxis(xAxisSvg, x, margin) {
  // Create x-axis with consistent styling
  xAxisSvg
    .append("g")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(x))
    .call((g) => chartStyles.applyAxisStyles(g)); // Apply shared axis styling
}

export default renderGroupedBarChart;
