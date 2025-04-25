/**
 * Grouped Bar Chart Component
 * Displays data grouped by primary and secondary dimensions as horizontal bars
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { chartControls } from "./utils/chartControls.js";
import * as chartUtils from "./utils/chartUtils.js";
import * as chartScales from "./utils/chartScales.js";
import * as chartAxes from "./utils/chartAxes.js";
import * as legendUtil from "./utils/legendUtil.js";

// -------------------------------------------------------------------------
// CHART DESIGN PARAMETERS
// -------------------------------------------------------------------------
const CHART_DESIGN = {
  barHeight: 15, // Height of each bar in pixels
  rowSpacing: 2, // Space between subgroup bars
  groupPadding: 8, // Space between groups
  cornerRadius: 0, // Rounded corner radius
  maxChartHeight: 650, // Maximum overall chart height
  minChartHeight: 500, // Minimum overall chart height
  labelGap: 10, // Gap between axis and labels
};
// -------------------------------------------------------------------------

/**
 * Main render function for grouped bar chart
 */
function renderGroupedBarChart(container) {
  if (!chartUtils.validateRenderingContext(container)) return;

  // Setup layout and extract dimensions/data
  const { chartContainer, legendContainer } = legendUtil.createHorizontalLayout(container);
  const dimensions = getDimensions();
  const dataset = state.dataset;
  const [groupKey, subGroupKey = null] = dimensions;
  const measure = state.aggregationDefinition.measures[0].alias;

  // Process data and create chart structure
  const { sortedGroups, sortedSubGroups } = processData(dataset, groupKey, subGroupKey, measure);
  const config = createConfig(sortedGroups, dataset, groupKey, subGroupKey);
  const scales = createScales(sortedGroups, sortedSubGroups, dataset, measure, config);

  // Render chart
  setupContainer(chartContainer, config);
  const { svg, xAxisSvg } = createChartElements(chartContainer, config);
  const tooltip = chartStyles.createTooltip();

  // Draw chart components
  drawBars(svg, dataset, scales, config, groupKey, subGroupKey, measure, tooltip);
  drawYAxis(svg, sortedGroups, scales.groupPositions, config);
  drawXAxis(xAxisSvg, scales.x, config.margin);

  // Create legend and setup events
  legendUtil.createColorLegend(legendContainer, sortedSubGroups, scales.color, {}, subGroupKey);
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
  // Create a copy of the margin object to avoid modifying the shared reference
  const margin = { ...chartStyles.getChartMargins("grouped_bar_chart") };

  const barHeight = CHART_DESIGN.barHeight;
  const groupPadding = CHART_DESIGN.groupPadding;

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
  const fullHeight = Math.max(margin.top + margin.bottom + contentHeight, CHART_DESIGN.minChartHeight);
  const displayHeight = Math.min(fullHeight, CHART_DESIGN.maxChartHeight);

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
  // Calculate group positions (keep this custom code)
  const groupPositions = {};
  let yPosition = config.margin.top;

  sortedGroups.forEach((group) => {
    groupPositions[group] = yPosition;
    yPosition += config.groupHeights[group];
  });

  // Get chart width
  const chartEl = document.querySelector(".viz-chart-area");
  const chartWidth = chartEl?.clientWidth || 800;

  // Create scales using utility functions
  return {
    x: chartScales.createMeasureScale(dataset, measure, [config.margin.left, chartWidth - config.margin.right - 10]),

    innerY: chartScales.createCategoryScale(
      sortedSubGroups,
      [0, d3.max(Object.values(config.groupHeights)) - config.groupPadding],
      CHART_DESIGN.rowSpacing / CHART_DESIGN.barHeight // Calculate padding factor for consistent spacing
    ),

    color: chartScales.createColorScale(sortedSubGroups),

    groupPositions,
  };
}

/**
 * Set up container styles
 */
function setupContainer(container, config) {
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${config.displayHeight}px`,
  });
}

/**
 * Create chart DOM elements
 */
function createChartElements(container, config) {
  // Clear container first
  container.innerHTML = "";

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
    .attr("y", (d) => d.y - CHART_DESIGN.groupPadding)
    .attr("width", (d) => Math.max(0, scales.x(d.val) - config.margin.left))
    .attr("height", scales.innerY.bandwidth())
    .attr("fill", (d) => scales.color(d.sub))
    .attr("rx", CHART_DESIGN.cornerRadius);

  // Attach tooltips with standardized format
  chartUtils.attachMouseTooltip(bars, tooltip, (d) =>
    chartUtils.createStandardTooltip({
      dimensions: [
        { name: groupKey, value: d.group },
        { name: subGroupKey, value: d.sub },
      ],
      measures: [{ name: measure, value: d.val, field: measure }],
    })
  );
}

/**
 * Draw Y axis with labels
 */
function drawYAxis(svg, sortedGroups, groupPositions, config) {
  const yAxisGroup = svg.append("g").attr("class", "y-axis").attr("transform", `translate(${config.margin.left}, 0)`);

  // Use chartAxes.createReferenceLine for the vertical axis line
  chartAxes.createReferenceLine(yAxisGroup, {
    orientation: "vertical",
    position: 0,
    start: 0,
    end: config.fullHeight - config.margin.top - config.margin.bottom,
    className: "y-axis-line",
  });

  // Add labels for each group
  yAxisGroup
    .selectAll(".group-label")
    .data(sortedGroups)
    .join("text")
    .attr("class", "group-label")
    .attr("x", -CHART_DESIGN.labelGap)
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
  chartAxes.renderMeasureAxis(xAxisSvg, xScale, {
    orientation: "top",
    position: { x: 0, y: margin.top - 1 },
    className: "x-axis",
  });
}

/**
 * Set up event handlers
 */
function setupEventHandlers(container) {
  chartUtils.setupResizeHandler(container, () => renderGroupedBarChart(container));
  chartUtils.setupDimensionSwapHandler(renderGroupedBarChart);
}

export default renderGroupedBarChart;
