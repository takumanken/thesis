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
  barHeight: 20, // Height of each bar in pixels
  rowSpacing: 15, // Space between rows in pixels
  cornerRadius: 0, // Rounded corner radius
  minChartHeight: 400, // Minimum overall chart height
  maxChartHeight: 650, // Maximum overall chart height
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
  renderBars(elements.svg, stackData, sortedStacks, scales, groupKey, stackKey, measure, isPercentage, color, tooltip);
  renderAxes(elements.svg, elements.xAxisSvg, scales, config, isPercentage);
  legendUtil.createColorLegend(legendContainer, sortedStacks, color);
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

    // Calculate percentages if needed
    if (isPercentage) {
      const total = d3.sum(Object.values(obj).filter((v) => typeof v === "number"));
      if (total > 0) {
        // Store original values and calculate percentages
        stacks.forEach((stack) => {
          obj[`${stack}_original`] = obj[stack];
          obj[stack] = (obj[stack] / total) * 100;
        });
      }
      obj._total = total;
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

  // Calculate chart dimensions
  const contentHeight = sortedGroups.length * rowHeight;
  const fullHeight = margin.top + margin.bottom + contentHeight;
  const adjustedFullHeight = Math.max(fullHeight, CHART_DESIGN.minChartHeight);
  const displayHeight = Math.min(adjustedFullHeight, CHART_DESIGN.maxChartHeight);

  return {
    margin,
    barHeight,
    rowHeight,
    rowSpacing,
    fullHeight: adjustedFullHeight,
    displayHeight,
    needsScrolling: adjustedFullHeight > displayHeight,
  };
}

/**
 * Create scales for the chart
 */
function createScales(sortedGroups, stackData, config, isPercentage) {
  const chartEl = document.querySelector(".viz-chart-area");
  const chartWidth = chartEl?.clientWidth || 800;
  const height = config.fullHeight - config.margin.top - config.margin.bottom;

  return {
    y: chartScales.createCategoryScale(sortedGroups, [0, height], config.rowSpacing / (config.rowHeight * 2)),

    x: isPercentage
      ? chartScales.createPercentageScale([config.margin.left, chartWidth - config.margin.right], false)
      : chartScales.createMeasureScale(
          stackData,
          // Custom accessor for stacked data
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
 * Render stacked bars
 */
function renderBars(svg, stackData, sortedStacks, scales, groupKey, stackKey, measure, isPercentage, color, tooltip) {
  const stackGen = d3.stack().keys(sortedStacks);
  const groups = svg.append("g").selectAll("g").data(stackGen(stackData)).join("g");

  const rects = groups
    .selectAll("rect")
    .data((layer) => layer)
    .join("rect")
    .attr("y", (d) => scales.y(d.data[groupKey]))
    .attr("x", (d) => scales.x(d[0]))
    .attr("width", (d) => Math.max(0, scales.x(d[1]) - scales.x(d[0])))
    .attr("height", scales.y.bandwidth())
    .attr("fill", (d, i, nodes) => color(d3.select(nodes[i].parentNode).datum().key));

  chartUtils.attachMouseTooltip(rects, tooltip, (d, el) => {
    const stackVal = d3.select(el.parentNode).datum().key;
    const grp = d.data[groupKey];
    const raw = isPercentage ? d.data[`${stackVal}_original`] : d.data[stackVal];
    const pct = isPercentage ? d.data[stackVal] : (raw / d.data._total) * 100;
    return `
        <strong>${groupKey}:</strong> ${grp}<br>
        <strong>${stackKey}:</strong> ${stackVal}<br>
        <strong>${measure}:</strong> ${chartUtils.formatValue(raw)}<br>
        <strong>Pct:</strong> ${pct.toFixed(CHART_DESIGN.percentagePrecision)}%
      `;
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
