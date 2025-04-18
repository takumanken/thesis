/**
 * Stacked Bar Chart Component
 * Displays data stacked by dimension values either as absolute values or percentages
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { chartControls } from "./utils/chartControls.js";
import {
  formatValue,
  setupResizeHandler,
  setupDimensionSwapHandler,
  validateRenderingContext,
  attachMouseTooltip,
} from "./utils/chartUtils.js";
import { createHorizontalLayout, createColorLegend } from "./utils/legendUtil.js";

// ===== CHART CONSTANTS =====

const CHART_DESIGN = {
  barHeight: 20, // Height of each bar in pixels
  rowSpacing: 15, // Space between rows in pixels
  cornerRadius: 0, // Rounded corner radius
  minChartHeight: 400, // Minimum overall chart height
  maxChartHeight: 650, // Maximum overall chart height
  percentagePrecision: 1, // Decimal places for percentage values
};

// ===== MAIN RENDERING FUNCTION =====

/**
 * Main render function for stacked bar chart
 */
function renderStackedBarChart(container) {
  if (!validateRenderingContext(container)) return;

  // Extract dimensions and settings
  const isPercentage = state.chartType === "stacked_bar_chart_100";
  const { chartContainer, legendContainer } = createHorizontalLayout(container);
  const dimensions = getDimensions();
  const [groupKey, stackKey] = dimensions;
  const measure = state.aggregationDefinition.measures[0].alias;

  // Process data
  const { stackData, sortedGroups, sortedStacks } = processData(
    state.dataset,
    groupKey,
    stackKey,
    measure,
    isPercentage
  );

  // Create chart structure
  const config = createConfig(sortedGroups);
  const scales = createScales(sortedGroups, stackData, config, isPercentage);
  const elements = createChartElements(chartContainer, config);
  const tooltip = chartStyles.createTooltip();

  // Create color scale
  const colorScale = d3.scaleOrdinal().domain(sortedStacks).range(chartColors.mainPalette);

  // Render chart components
  renderBars(
    elements.svg,
    stackData,
    sortedStacks,
    scales,
    { groupKey, stackKey, measure },
    isPercentage,
    colorScale,
    tooltip
  );

  renderAxes(elements.svg, elements.xAxisSvg, scales, config, isPercentage);
  createColorLegend(legendContainer, sortedStacks, colorScale);

  // Setup event handlers
  setupEventHandlers(container);
}

// ===== DATA PREPARATION =====

/**
 * Get dimensions from dimension control or state
 */
function getDimensions() {
  return chartControls.initDimensionSwap("stacked_bar_chart")
    ? chartControls.getSwappableDimensions()
    : state.aggregationDefinition.dimensions;
}

/**
 * Process data for stacked bar chart
 */
function processData(dataset, groupKey, stackKey, measure, isPercentage) {
  if (!dataset?.length) {
    return { stackData: [], sortedGroups: [], sortedStacks: [] };
  }

  // Extract unique values
  const groups = [...new Set(dataset.map((d) => d[groupKey]))];
  const stacks = [...new Set(dataset.map((d) => d[stackKey]))];

  if (!groups.length || !stacks.length) {
    return { stackData: [], sortedGroups: [], sortedStacks: [] };
  }

  // Calculate group totals and sort groups
  const sortedGroups = getSortedGroups(dataset, groups, groupKey, measure);

  // Create data structure for stacking
  const stackData = createStackData(dataset, sortedGroups, stacks, groupKey, stackKey, measure, isPercentage);

  return { stackData, sortedGroups, sortedStacks: stacks };
}

/**
 * Sort groups by total measure value
 */
function getSortedGroups(dataset, groups, groupKey, measure) {
  // Calculate totals per group
  const groupTotals = {};

  groups.forEach((group) => {
    groupTotals[group] = d3.sum(
      dataset.filter((d) => d[groupKey] === group),
      (d) => +d[measure] || 0
    );
  });

  // Sort groups by total (descending)
  return [...groups].sort((a, b) => groupTotals[b] - groupTotals[a]);
}

/**
 * Create data structure for stacking
 */
function createStackData(dataset, sortedGroups, stacks, groupKey, stackKey, measure, isPercentage) {
  return sortedGroups.map((group) => {
    // Base object with group key
    const obj = { [groupKey]: group };
    let total = 0;

    // Add values for each stack
    stacks.forEach((stack) => {
      const item = dataset.find((d) => d[groupKey] === group && d[stackKey] === stack);
      const value = item ? +item[measure] || 0 : 0;
      obj[stack] = value;
      total += value;
    });

    // Calculate percentages if needed
    if (isPercentage && total > 0) {
      // Store original values and calculate percentages
      stacks.forEach((stack) => {
        obj[`${stack}_original`] = obj[stack];
        obj[stack] = total > 0 ? (obj[stack] / total) * 100 : 0;
      });
    }

    obj._total = total;
    return obj;
  });
}

// ===== CHART CONFIGURATION =====

/**
 * Create chart configuration
 */
function createConfig(sortedGroups) {
  const margin = chartStyles.getChartMargins("stacked_bar_chart");

  // Set up row dimensions
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
 * Create scales for chart axes
 */
function createScales(sortedGroups, stackData, config, isPercentage) {
  // Get chart dimensions
  const height = config.fullHeight - config.margin.top - config.margin.bottom;
  const chartEl = document.querySelector(".viz-chart-area");
  const chartWidth = chartEl?.clientWidth || 800;

  // Y scale - positions each group
  const y = d3
    .scaleBand()
    .domain(sortedGroups)
    .range([0, height])
    .padding(config.rowSpacing / (config.rowHeight * 2));

  // X scale - measure values
  const xMax = calculateXMaxValue(stackData, sortedGroups, isPercentage);

  const x = d3
    .scaleLinear()
    .domain([0, isPercentage ? 100 : xMax * 1.05])
    .range([config.margin.left, chartWidth - config.margin.right - (isPercentage ? 0 : 10)])
    .nice();

  return { x, y };
}

/**
 * Calculate maximum X value for scale domain
 */
function calculateXMaxValue(stackData, sortedGroups, isPercentage) {
  if (isPercentage) return 100;

  return (
    d3.max(stackData, (d) => {
      return d3.sum(
        Object.entries(d)
          .filter(([key]) => key !== sortedGroups[0] && !key.includes("_"))
          .map(([_, val]) => +val || 0)
      );
    }) || 0
  );
}

// ===== DOM ELEMENTS =====

/**
 * Create chart DOM elements
 */
function createChartElements(container, config) {
  // Clear container
  container.innerHTML = "";

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

// ===== CHART RENDERING =====

/**
 * Render stacked bars
 */
function renderBars(svg, stackData, sortedStacks, scales, dimensions, isPercentage, colorScale, tooltip) {
  const { groupKey, stackKey, measure } = dimensions;

  // Create stack generator and process data
  const stackGen = d3.stack().keys(sortedStacks);
  const stackedData = stackGen(stackData);

  // Pre-process bars for rendering
  const barData = createFlattenedBarData(stackedData, scales, colorScale, groupKey);

  // Render bars
  const rects = svg
    .append("g")
    .selectAll("rect")
    .data(barData)
    .join("rect")
    .attr("y", (d) => d.y)
    .attr("x", (d) => d.x)
    .attr("width", (d) => d.width)
    .attr("height", (d) => d.height)
    .attr("fill", (d) => d.fill);

  // Attach tooltips
  attachBarTooltips(rects, tooltip, dimensions, isPercentage);
}

/**
 * Create flattened bar data structure for rendering
 */
function createFlattenedBarData(stackedData, scales, colorScale, groupKey) {
  const bars = [];

  stackedData.forEach((layer) => {
    const stackVal = layer.key;
    const stackColor = colorScale(stackVal);

    layer.forEach((d) => {
      // Skip bars with zero width
      const width = Math.max(0, scales.x(d[1]) - scales.x(d[0]));
      if (width <= 0) return;

      bars.push({
        originalData: d,
        stackKey: stackVal,
        groupKey: d.data[groupKey],
        y: scales.y(d.data[groupKey]),
        x: scales.x(d[0]),
        width: width,
        height: scales.y.bandwidth(),
        fill: stackColor,
        data: d.data,
        values: [d[0], d[1]],
      });
    });
  });

  return bars;
}

/**
 * Attach tooltips to bars
 */
function attachBarTooltips(bars, tooltip, dimensions, isPercentage) {
  const { groupKey, stackKey, measure } = dimensions;

  attachMouseTooltip(bars, tooltip, (d) => {
    const stackVal = d.stackKey;
    const groupVal = d.groupKey;
    const raw = isPercentage ? d.data[`${stackVal}_original`] : d.data[stackVal];
    const pct = isPercentage ? d.data[stackVal] : (raw / d.data._total) * 100;

    return `
        <strong>${groupKey}:</strong> ${groupVal}<br>
        <strong>${stackKey}:</strong> ${stackVal}<br>
        <strong>${measure}:</strong> ${formatValue(raw)}<br>
        <strong>Pct:</strong> ${pct.toFixed(CHART_DESIGN.percentagePrecision)}%
      `;
  });
}

/**
 * Render chart axes
 */
function renderAxes(svg, xAxisSvg, scales, config, isPercentage) {
  // Y axis with labels
  const yAxis = svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${config.margin.left},0)`)
    .call(d3.axisLeft(scales.y));

  chartStyles.applyAxisStyles(yAxis);

  // X axis with formatted values
  const xAxis = xAxisSvg
    .append("g")
    .attr("transform", `translate(0,${config.margin.top - 1})`)
    .call(
      d3
        .axisTop(scales.x)
        .ticks(5)
        .tickFormat(isPercentage ? (d) => `${d}%` : formatValue)
    );

  chartStyles.applyAxisStyles(xAxis);
}

/**
 * Setup event handlers
 */
function setupEventHandlers(container) {
  setupResizeHandler(container, () => renderStackedBarChart(container));
  setupDimensionSwapHandler(renderStackedBarChart);
}

export default renderStackedBarChart;
