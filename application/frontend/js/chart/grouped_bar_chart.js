/**
 * Grouped Bar Chart Component
 * Displays data grouped by primary and secondary dimensions as horizontal bars
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { chartControls } from "./utils/chartControls.js";
import {
  formatValue,
  setupResizeHandler,
  validateRenderingContext,
  setupDimensionSwapHandler,
  attachMouseTooltip,
} from "./utils/chartUtils.js";
import { createHorizontalLayout, createColorLegend } from "./utils/legendUtil.js";

/**
 * Main render function for grouped bar chart
 */
function renderGroupedBarChart(container) {
  if (!validateRenderingContext(container)) return;

  // Setup layout and extract dimensions/data
  const { chartContainer, legendContainer } = createHorizontalLayout(container);
  const dimensions = getDimensions();
  const dataset = state.dataset;
  const [groupKey, subGroupKey = null] = dimensions;
  const measure = state.aggregationDefinition.measures[0].alias;

  // Process data and create chart structure
  const { sortedGroups, sortedSubGroups } = processData(dataset, groupKey, subGroupKey, measure);
  const config = createConfig(sortedGroups, dataset, groupKey, subGroupKey);
  const scales = createScales(sortedGroups, sortedSubGroups, dataset, measure, config);

  // Render chart
  setupContainer(chartContainer);
  const { svg, xAxisSvg } = createChartElements(chartContainer, config);
  const tooltip = chartStyles.createTooltip();

  // Draw chart components
  drawBars(svg, dataset, scales, config, groupKey, subGroupKey, measure, tooltip);
  drawYAxis(svg, sortedGroups, scales.groupPositions, config);
  drawXAxis(xAxisSvg, scales.x, config.margin);

  // Create legend and setup events
  createColorLegend(legendContainer, sortedSubGroups, scales.color);
  setupEventHandlers(container);
}

/**
 * Get dimensions from state or dimension controls
 */
function getDimensions() {
  return chartControls.initDimensionSwap("grouped_bar_chart")
    ? chartControls.getSwappableDimensions()
    : state.aggregationDefinition.dimensions;
}

/**
 * Process and sort data for both group levels
 */
function processData(dataset, groupKey, subGroupKey, measure) {
  // Exit early if dataset is invalid
  if (!dataset || !dataset.length) {
    return { sortedGroups: [], sortedSubGroups: [] };
  }

  // Sort groups by total value
  const groupData = Array.from(
    d3.rollup(
      dataset,
      (values) => d3.sum(values, (d) => +d[measure] || 0),
      (d) => d[groupKey]
    ),
    ([key, sum]) => ({ key, sum })
  )
    .sort((a, b) => d3.descending(a.sum, b.sum))
    .map((d) => d.key);

  // Only process subgroups if we have a subGroupKey
  let subGroupData = [];
  if (subGroupKey) {
    subGroupData = Array.from(
      d3.rollup(
        dataset,
        (values) => d3.sum(values, (d) => +d[measure] || 0),
        (d) => d[subGroupKey]
      ),
      ([key, sum]) => ({ key, sum })
    )
      .sort((a, b) => d3.descending(a.sum, b.sum))
      .map((d) => d.key);
  }

  return {
    sortedGroups: groupData,
    sortedSubGroups: subGroupData,
  };
}

/**
 * Create chart configuration with sizing and layout parameters
 */
function createConfig(sortedGroups, dataset, groupKey, subGroupKey) {
  const margin = chartStyles.getChartMargins("grouped_bar_chart");
  const barHeight = chartStyles.barChart.bar.height * 0.6;
  const groupPadding = chartStyles.barChart.bar.height * 0.8;

  // Calculate heights for each group based on number of subgroups
  const groupHeights = {};
  for (const group of sortedGroups) {
    const uniqueSubgroups = subGroupKey
      ? new Set(dataset.filter((d) => d[groupKey] === group).map((d) => d[subGroupKey])).size
      : 1;

    groupHeights[group] = uniqueSubgroups * barHeight + groupPadding;
  }

  // Calculate overall dimensions
  const contentHeight = Object.values(groupHeights).reduce((sum, h) => sum + h, 0);
  const minHeight = 500;
  const fullHeight = Math.max(margin.top + margin.bottom + contentHeight, minHeight);
  const displayHeight = Math.min(fullHeight, chartStyles.barChart.maxHeight);

  return {
    margin,
    barHeight,
    groupPadding,
    groupHeights,
    fullHeight,
    displayHeight,
    needsScrolling: fullHeight > displayHeight,
  };
}

/**
 * Create scales for positioning and coloring chart elements
 */
function createScales(sortedGroups, sortedSubGroups, dataset, measure, config) {
  // Calculate position for each group
  const groupPositions = {};
  let yPosition = config.margin.top;

  sortedGroups.forEach((group) => {
    groupPositions[group] = yPosition;
    yPosition += config.groupHeights[group];
  });

  // Get chart width
  const chartEl = document.querySelector(".viz-chart-area");
  const chartWidth = chartEl?.clientWidth || 800;

  // Create and return all scales
  return {
    x: d3
      .scaleLinear()
      .domain([0, d3.max(dataset, (d) => +d[measure] || 0) * 1.05])
      .range([config.margin.left, chartWidth - config.margin.right - 10])
      .nice(),

    innerY: d3
      .scaleBand()
      .domain(sortedSubGroups)
      .range([0, d3.max(Object.values(config.groupHeights)) - config.groupPadding])
      .padding(chartStyles.barChart.bar.padding),

    color: d3.scaleOrdinal().domain(sortedSubGroups).range(chartColors.mainPalette),

    groupPositions,
  };
}

/**
 * Set up container styles
 */
function setupContainer(container) {
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
  });
}

/**
 * Create chart DOM elements
 */
function createChartElements(container, config) {
  // Create axis and scroll containers
  const xAxisContainer = document.createElement("div");
  xAxisContainer.className = "viz-axis-container";

  const scrollContainer = document.createElement("div");
  scrollContainer.className = "viz-bar-scroll";
  Object.assign(scrollContainer.style, {
    position: "absolute",
    top: `${config.margin.top}px`,
    bottom: "20px",
    left: "0",
    right: "0",
    overflowY: config.needsScrolling ? "auto" : "hidden",
    overflowX: "hidden",
  });

  container.appendChild(xAxisContainer);
  container.appendChild(scrollContainer);

  // Create SVG elements
  const svg = d3
    .select(scrollContainer)
    .append("svg")
    .attr("class", "viz-grouped-bar-canvas")
    .attr("width", "100%")
    .attr("height", config.fullHeight - config.margin.top);

  const xAxisSvg = d3
    .select(xAxisContainer)
    .append("svg")
    .attr("class", "viz-axis-canvas")
    .attr("width", "100%")
    .attr("height", config.margin.top);

  return { svg, xAxisSvg };
}

/**
 * Draw bars with tooltips
 */
function drawBars(svg, dataset, scales, config, groupKey, subGroupKey, measure, tooltip) {
  // Create data for bars with pre-calculated positions
  const barData = dataset.map((d) => ({
    group: d[groupKey],
    sub: d[subGroupKey],
    val: +d[measure] || 0,
    y: scales.groupPositions[d[groupKey]] + scales.innerY(d[subGroupKey]),
  }));

  // Draw bars
  const bars = svg
    .selectAll("rect")
    .data(barData)
    .join("rect")
    .attr("x", config.margin.left)
    .attr("y", (d) => d.y)
    .attr("width", (d) => Math.max(0, scales.x(d.val) - config.margin.left))
    .attr("height", scales.innerY.bandwidth())
    .attr("fill", (d) => scales.color(d.sub))
    .attr("rx", chartStyles.barChart.bar.cornerRadius);

  // Attach tooltips
  attachMouseTooltip(
    bars,
    tooltip,
    (d) => `
      <strong>${groupKey}:</strong> ${d.group}<br>
      <strong>${subGroupKey}:</strong> ${d.sub}<br>
      <strong>${measure}:</strong> ${formatValue(d.val)}
    `
  );
}

/**
 * Draw Y axis with labels
 */
function drawYAxis(svg, sortedGroups, groupPositions, config) {
  const yAxisGroup = svg.append("g").attr("class", "y-axis").attr("transform", `translate(${config.margin.left}, 0)`);

  // Add vertical axis line
  yAxisGroup
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", config.fullHeight - config.margin.top - config.margin.bottom)
    .attr("stroke", chartStyles.colors.axisLine)
    .attr("stroke-width", 1)
    .attr("shape-rendering", "crispEdges");

  // Add labels centered in each group
  yAxisGroup
    .selectAll(".group-label")
    .data(sortedGroups)
    .join("text")
    .attr("class", "group-label")
    .attr("x", -10)
    .attr("y", (d) => {
      const effectiveBarsHeight = config.groupHeights[d] - config.groupPadding;
      return groupPositions[d] + effectiveBarsHeight / 2;
    })
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .text((d) => d)
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel)
    .style("font-weight", "500")
    .style("fill", chartStyles.colors.text);
}

/**
 * Draw X axis
 */
function drawXAxis(xAxisSvg, xScale, margin) {
  const axis = xAxisSvg
    .append("g")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(xScale).ticks(5).tickFormat(formatValue));

  chartStyles.applyAxisStyles(axis);
}

/**
 * Set up event handlers
 */
function setupEventHandlers(container) {
  setupResizeHandler(container, () => renderGroupedBarChart(container));
  setupDimensionSwapHandler(renderGroupedBarChart);
}

export default renderGroupedBarChart;
