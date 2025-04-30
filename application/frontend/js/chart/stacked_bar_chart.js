/**
 * Stacked Bar Chart Component
 * Displays data stacked by dimension values either as absolute values or percentages
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
  barHeight: 18, // Height of each bar in pixels
  rowSpacing: 25, // Space between rows in pixels
  cornerRadius: 0, // Rounded corner radius
  maxChartHeight: 650, // Maximum overall chart height
  minChartHeight: 400, // Minimum overall chart height
  percentagePrecision: 1, // Decimal places for percentage values
};
// -------------------------------------------------------------------------

/**
 * Main render function for stacked bar chart
 */
function renderStackedBarChart(container) {
  if (!chartUtils.validateRenderingContext(container)) return;

  // Extract data and settings
  const isPercentage = state.chartType === "stacked_bar_chart_100";
  const { chartContainer, legendContainer } = legendUtil.createHorizontalLayout(container);
  const dimensions = chartControls.initDimensionSwap("stacked_bar_chart")
    ? chartControls.getSwappableDimensions()
    : state.aggregationDefinition.dimensions;

  const dataset = state.dataset;
  const [groupKey, stackKey] = dimensions;
  const measure = state.aggregationDefinition.measures[0].alias;

  // Process data and create chart
  const { stackData, sortedGroups, sortedStacks } = processData(dataset, groupKey, stackKey, measure, isPercentage);
  const config = createConfig(sortedGroups);
  const scales = createScales(sortedGroups, stackData, config, isPercentage);
  const elements = createChartElements(chartContainer, config);

  // Setup visualization
  const color = d3.scaleOrdinal().domain(sortedStacks).range(chartColors.mainPalette);
  const tooltip = chartStyles.createTooltip();

  // Render chart components
  renderBars(
    elements.svg,
    stackData,
    sortedStacks,
    scales,
    groupKey,
    stackKey,
    measure,
    isPercentage,
    color,
    tooltip,
    config
  );
  renderAxes(elements.svg, elements.xAxisSvg, scales, config, isPercentage);
  legendUtil.createColorLegend(legendContainer, sortedStacks, color, {}, stackKey, "stackedBar");
  setupEventHandlers(container);
}

/**
 * Process data for stacked bar chart
 */
function processData(dataset, groupKey, stackKey, measure, isPercentage) {
  // Get unique values and calculate totals
  const groups = [...new Set(dataset.map((d) => d[groupKey]))];
  const stacks = [...new Set(dataset.map((d) => d[stackKey]))];

  // Calculate totals and sort groups by total measure value
  const groupTotals = Object.fromEntries(
    groups.map((group) => [
      group,
      d3.sum(
        dataset.filter((d) => d[groupKey] === group),
        (d) => d[measure] || 0
      ),
    ])
  );

  const sortedGroups = [...groups].sort((a, b) => groupTotals[b] - groupTotals[a]);

  // Create data structure for stacking
  const stackData = sortedGroups.map((group) => {
    // Base object with group key
    const obj = { [groupKey]: group };

    // Add values for each stack
    stacks.forEach((stack) => {
      const item = dataset.find((d) => d[groupKey] === group && d[stackKey] === stack);
      obj[stack] = item ? item[measure] || 0 : 0;
    });

    // Calculate total for all chart types
    const total = stacks.reduce((sum, stack) => sum + (obj[stack] || 0), 0);
    obj._total = total;

    // Calculate percentages if needed
    if (isPercentage && total > 0) {
      // Store original values and calculate percentages
      stacks.forEach((stack) => {
        obj[`${stack}_original`] = obj[stack];
        obj[stack] = (obj[stack] / total) * 100;
      });
    }

    return obj;
  });

  return { stackData, sortedGroups, sortedStacks: stacks };
}

/**
 * Create chart configuration
 */
function createConfig(sortedGroups) {
  const margin = chartStyles.getChartMargins("stacked_bar_chart");

  // Set up fixed row dimensions
  const barHeight = CHART_DESIGN.barHeight;
  const rowSpacing = CHART_DESIGN.rowSpacing;
  const rowHeight = barHeight + rowSpacing;

  // Calculate chart dimensions - dynamically based on number of groups
  const contentHeight = sortedGroups.length * rowHeight;
  const fullHeight = margin.top + margin.bottom + contentHeight;
  const adjustedFullHeight = fullHeight;

  const displayHeight = Math.min(adjustedFullHeight, CHART_DESIGN.maxChartHeight);

  return {
    margin,
    barHeight, // Add actual barHeight to config
    rowHeight,
    rowSpacing,
    fullHeight: adjustedFullHeight,
    displayHeight,
    needsScrolling: adjustedFullHeight > displayHeight,
  };
}

/**
 * Create scales for the chart - use a fixed step size for Y scale
 */
function createScales(sortedGroups, stackData, config, isPercentage) {
  const chartEl = document.querySelector(".viz-chart-area");
  const chartWidth = chartEl?.clientWidth || 800;

  // Calculate step size for Y scale to match our desired row height
  const yDomain = sortedGroups;
  const yStep = config.rowHeight;
  const yRange = [0, yStep * yDomain.length];

  return {
    // Use D3's scalePoint which allows us to specify the step size exactly
    y: d3
      .scalePoint()
      .domain(yDomain)
      .range(yRange)
      .padding(0.5) // Center points in their step
      .round(true), // Round to pixel values

    x: isPercentage
      ? chartScales.createPercentageScale([config.margin.left, chartWidth - config.margin.right], false)
      : chartScales.createMeasureScale(
          stackData,
          (d) =>
            d3.sum(
              Object.entries(d)
                .filter(([key]) => key !== sortedGroups[0] && !key.includes("_"))
                .map(([_, val]) => +val || 0)
            ),
          [config.margin.left, chartWidth - config.margin.right - 10]
        ),
  };
}

/**
 * Create chart DOM elements
 */
function createChartElements(container, config) {
  // Create container elements
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

  // Apply styles to main container
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
  });

  // Add to DOM
  container.appendChild(xAxisContainer);
  container.appendChild(scrollContainer);

  // Create SVG elements
  const svg = d3
    .select(scrollContainer)
    .append("svg")
    .attr("class", "viz-stacked-bar-canvas")
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
 * Render stacked bars with fixed height
 */
function renderBars(
  svg,
  stackData,
  sortedStacks,
  scales,
  groupKey,
  subGroupKey,
  measure,
  isPercentage,
  color,
  tooltip,
  config
) {
  const stackGen = d3.stack().keys(sortedStacks);
  const groups = svg.append("g").selectAll("g").data(stackGen(stackData)).join("g");

  const rects = groups
    .selectAll("rect")
    .data((layer) => layer)
    .join("rect")
    .attr("y", (d) => scales.y(d.data[groupKey]) - config.barHeight / 2)
    .attr("x", (d) => scales.x(d[0]))
    .attr("width", (d) => Math.max(0, scales.x(d[1]) - scales.x(d[0]) - 1))
    .attr("height", config.barHeight)
    .attr("fill", (d, i, nodes) => color(d3.select(nodes[i].parentNode).datum().key))
    .attr("data-group", (d, i, nodes) => d3.select(nodes[i].parentNode).datum().key); // Add this line

  // Update tooltip to use standardized format
  chartUtils.attachMouseTooltip(rects, tooltip, (d, el) => {
    const stackVal = d3.select(el.parentNode).datum().key;
    const grp = d.data[groupKey];
    const raw = isPercentage ? d.data[`${stackVal}_original`] : d.data[stackVal];
    const total = d.data._total;
    const pct = total > 0 ? (raw / total) * 100 : 0;

    return chartUtils.createStandardTooltip({
      dimensions: [
        { name: groupKey, value: grp },
        { name: subGroupKey, value: stackVal },
      ],
      measures: [
        { name: measure, value: raw, field: measure },
        { name: "Percentage", value: `${pct.toFixed(CHART_DESIGN.percentagePrecision)}%`, field: "percentage" },
      ],
    });
  });

  // Add value labels that will show on highlight
  renderValueLabels(svg, stackData, sortedStacks, scales, groupKey, isPercentage, color, config);
}

/**
 * Render hidden value labels
 */
function renderValueLabels(svg, stackData, sortedStacks, scales, groupKey, isPercentage, color, config) {
  // Get the rightmost stack data
  const stackGen = d3.stack().keys(sortedStacks);
  const stackedData = stackGen(stackData);

  // For each group and stack, create a label
  sortedStacks.forEach((stack, stackIndex) => {
    svg
      .selectAll(`.label-stack-${stack}`)
      .data(stackData)
      .join("text")
      .attr("class", `label-stackedBar label-stack-${stack}`)
      .attr("data-group", stack)
      .attr("x", (d) => {
        // Find the rightmost edge for this stack in this group
        const layerData = stackedData[stackIndex].find((entry) => entry.data[groupKey] === d[groupKey]);
        return scales.x(layerData ? layerData[1] : 0) + 5; // 5px padding
      })
      .attr("y", (d) => scales.y(d[groupKey]))
      .attr("dy", "0.35em") // Vertical centering
      .attr("text-anchor", "start")
      .attr("font-size", "11px")
      .style("opacity", 0) // Hidden by default
      .text((d) => {
        const val = d[stack];
        if (isPercentage) {
          return `${parseFloat(val).toFixed(1)}%`;
        }
        return chartUtils.formatValue(val);
      });
  });
}

/**
 * Render chart axes
 */
function renderAxes(svg, xAxisSvg, scales, config, isPercentage) {
  // Y axis with labels
  chartAxes.renderCategoryAxis(svg, scales.y, null, {
    orientation: "left",
    position: { x: config.margin.left, y: 0 },
    className: "y-axis",
  });

  // X axis with formatted values
  chartAxes.renderMeasureAxis(xAxisSvg, scales.x, {
    orientation: "top",
    position: { x: 0, y: config.margin.top - 1 },
    tickCount: 5,
    isPercentage: isPercentage && "not-normalized",
    className: "x-axis",
  });
}

/**
 * Set up chart event handlers
 */
function setupEventHandlers(container) {
  chartUtils.setupResizeHandler(container, () => renderStackedBarChart(container));
  chartUtils.setupDimensionSwapHandler(renderStackedBarChart);
}

export default renderStackedBarChart;
