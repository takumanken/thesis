/**
 * Grouped Bar Chart Component
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
} from "./utils/chartUtils.js";
import { createHorizontalLayout, createColorLegend } from "./utils/legendUtil.js";

/**
 * Main render function for grouped bar chart
 */
function renderGroupedBarChart(container) {
  if (!validateRenderingContext(container)) return;

  // Setup layout and extract dimensions
  const { chartContainer, legendContainer } = createHorizontalLayout(container);
  const dimensions = chartControls.initDimensionSwap("grouped_bar_chart")
    ? chartControls.getSwappableDimensions()
    : state.aggregationDefinition.dimensions;

  // Get data and keys
  const dataset = state.dataset;
  const [groupKey, subGroupKey = null] = dimensions;
  const measure = state.aggregationDefinition.measures[0].alias;

  // Process data and render chart
  const { sortedGroups, sortedSubGroups } = processData(dataset, groupKey, subGroupKey, measure);
  const config = createConfig(sortedGroups, dataset, groupKey, subGroupKey);
  const scales = createScales(sortedGroups, sortedSubGroups, dataset, measure, config);

  // Render chart content
  setupContainer(chartContainer);
  const elements = createChartElements(chartContainer, config);
  renderChart(elements, dataset, sortedGroups, scales, config, groupKey, subGroupKey, measure);

  // Create legend and setup events
  createColorLegend(legendContainer, sortedSubGroups, scales.color);
  setupEventHandlers(container);
}

/**
 * Process and sort data
 */
function processData(dataset, groupKey, subGroupKey, measure) {
  // Reusable functions for data processing
  const sum = (v) => d3.sum(v, (d) => d[measure]);
  const byValue = (a, b) => d3.descending(a.sum, b.sum);
  const getKey = (d) => d.key;

  // Process main groups
  const groupData = Array.from(
    d3.rollup(dataset, sum, (d) => d[groupKey]),
    ([key, sum]) => ({ key, sum })
  )
    .sort(byValue)
    .map(getKey);

  // Process subgroups if available
  const subGroupData = subGroupKey
    ? Array.from(
        d3.rollup(dataset, sum, (d) => d[subGroupKey]),
        ([key, sum]) => ({ key, sum })
      )
        .sort(byValue)
        .map(getKey)
    : [];

  return {
    sortedGroups: groupData,
    sortedSubGroups: subGroupData,
  };
}

/**
 * Create chart configuration
 */
function createConfig(sortedGroups, dataset, groupKey, subGroupKey) {
  const margin = chartStyles.getChartMargins("grouped_bar_chart");
  const barHeight = chartStyles.barChart.bar.height * 0.6;
  const groupPadding = chartStyles.barChart.bar.height * 0.8;

  // Calculate heights for each group
  const groupHeights = Object.fromEntries(
    sortedGroups.map((group) => {
      const uniqueSubgroups = subGroupKey
        ? new Set(dataset.filter((d) => d[groupKey] === group).map((d) => d[subGroupKey])).size
        : 1;

      return [group, uniqueSubgroups * barHeight + groupPadding];
    })
  );

  // Calculate overall dimensions
  const contentHeight = Object.values(groupHeights).reduce((sum, h) => sum + h, 0);
  const minHeight = 500; // Consistent with other charts
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
 * Create chart scales
 */
function createScales(sortedGroups, sortedSubGroups, dataset, measure, config) {
  // Calculate positions for each group
  let yPosition = config.margin.top;
  const groupPositions = {};
  const groupPositionsArray = [];

  for (const group of sortedGroups) {
    groupPositions[group] = yPosition;
    groupPositionsArray.push({ group, position: yPosition, height: config.groupHeights[group] });
    yPosition += config.groupHeights[group];
  }

  // Get width from container or use default if not found
  const chartEl = document.querySelector(".viz-chart-area");
  const chartWidth = chartEl?.clientWidth || 800; // Fallback width

  // Create scales
  return {
    outerY: d3
      .scaleOrdinal()
      .domain(sortedGroups)
      .range(sortedGroups.map((g) => groupPositions[g])),

    innerY: d3
      .scaleBand()
      .domain(sortedSubGroups)
      .range([0, d3.max(Object.values(config.groupHeights)) - config.groupPadding])
      .padding(chartStyles.barChart.bar.padding),

    x: d3
      .scaleLinear()
      .domain([0, d3.max(dataset, (d) => d[measure] || 0) * 1.05])
      .range([config.margin.left, chartWidth - config.margin.right - 10])
      .nice(),

    color: d3.scaleOrdinal().domain(sortedSubGroups).range(chartColors.mainPalette),

    groupPositions,
    groupPositionsArray,
  };
}

/**
 * Set up container styles
 */
function setupContainer(container) {
  // Don't set a fixed pixel height - let it use 100% from layout utility
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    // height is already set to 100% by createHorizontalLayout
  });
}

/**
 * Create chart DOM elements
 */
function createChartElements(container, config) {
  // Create containers
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
 * Render all chart content
 */
function renderChart(elements, dataset, sortedGroups, scales, config, groupKey, subGroupKey, measure) {
  const { svg, xAxisSvg } = elements;
  const tooltip = chartStyles.createTooltip();

  // Draw chart elements
  drawBars(svg, dataset, scales, config, groupKey, subGroupKey, measure, tooltip);
  drawYAxis(svg, sortedGroups, scales.groupPositions, config);
  drawXAxis(xAxisSvg, scales.x, config.margin);
}

/**
 * Draw grouped bars with tooltips
 */
function drawBars(svg, dataset, scales, config, groupKey, subGroupKey, measure, tooltip) {
  const { outerY, innerY, x, color, groupPositionsArray } = scales;
  const { margin } = config;

  svg
    .append("g")
    .selectAll("g")
    .data(groupPositionsArray)
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
    .attr("width", (d) => Math.max(0, x(d[measure]) - margin.left))
    .attr("height", innerY.bandwidth())
    .attr("fill", (d) => color(d[subGroupKey]))
    .attr("rx", chartStyles.barChart.bar.cornerRadius)
    .on("mouseover", function (event, d) {
      chartStyles.showTooltip(
        tooltip,
        event,
        `<strong>${groupKey}:</strong> ${d[groupKey]}<br>
         <strong>${subGroupKey}:</strong> ${d[subGroupKey]}<br>
         <strong>${measure}:</strong> ${formatValue(d[measure])}`
      );
    })
    .on("mouseout", () => chartStyles.hideTooltip(tooltip));
}

/**
 * Draw Y axis with labels
 */
function drawYAxis(svg, sortedGroups, groupPositions, config) {
  const yAxisGroup = svg.append("g").attr("class", "y-axis").attr("transform", `translate(${config.margin.left}, 0)`);

  // Add vertical axis line (unchanged)
  yAxisGroup
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", config.fullHeight - config.margin.top - config.margin.bottom)
    .attr("stroke", chartStyles.colors.axisLine)
    .attr("stroke-width", 1)
    .attr("shape-rendering", "crispEdges");

  // Calculate the actual visual center of each group's bars
  yAxisGroup
    .selectAll(".group-label")
    .data(sortedGroups)
    .join("text")
    .attr("class", "group-label")
    .attr("x", -10)
    .attr("y", (d) => {
      // Get the effective height of bars without padding
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
