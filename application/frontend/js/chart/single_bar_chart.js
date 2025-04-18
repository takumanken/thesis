/**
 * Single Bar Chart Component
 * Displays categorical data with a single measure as horizontal bars
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import {
  truncateLabel,
  formatValue,
  setupResizeHandler,
  validateRenderingContext,
  attachMouseTooltip,
} from "./utils/chartUtils.js";

/**
 * Main render function for single bar chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderBarChart(container) {
  if (!validateRenderingContext(container)) return;

  // Extract data and create configuration
  const { dataset, dimension, measure } = extractChartData();
  const config = setupChartConfiguration(container, dataset);

  // Setup DOM structure and create visualization components
  const { svg, xAxisSvg } = createDomStructure(container, config);
  const scales = createScales(dataset, measure, config);
  const tooltip = chartStyles.createTooltip();

  // Render all chart components
  renderBars(svg, dataset, scales, measure, dimension, config, tooltip);
  renderBarLabels(svg, dataset, scales, measure);
  renderYAxis(svg, dataset, scales.y, dimension, config.margin);
  renderXAxis(xAxisSvg, scales.x, config.margin);

  // Setup resize handling
  setupResizeHandler(container, () => renderBarChart(container));
}

/**
 * Extracts chart data from state
 * @returns {Object} Object containing dataset, dimension and measure
 */
function extractChartData() {
  return {
    dataset: state.dataset || [],
    dimension: state.aggregationDefinition.dimensions[0],
    measure: state.aggregationDefinition.measures[0]?.alias,
  };
}

/**
 * Sets up chart configuration with sizing and appearance
 * @param {HTMLElement} container - Chart container
 * @param {Array} dataset - Data to visualize
 * @returns {Object} Chart configuration object
 */
function setupChartConfiguration(container, dataset) {
  const margin = chartStyles.getChartMargins("horizontal_bar_chart");
  const barHeight = chartStyles.barChart.bar.height;
  const containerWidth = container.clientWidth || 800;

  // Determine chart dimensions
  const dataLength = dataset?.length || 0;
  const fullChartHeight = margin.top + margin.bottom + barHeight * dataLength;
  const displayHeight = Math.min(fullChartHeight, chartStyles.barChart.maxHeight);

  // Configure container element
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${displayHeight}px`,
  });

  return {
    margin,
    containerWidth,
    displayHeight,
    fullChartHeight,
    needsScrolling: fullChartHeight > displayHeight,
    barColor: chartColors.sequential.blue.base,
  };
}

/**
 * Creates chart DOM structure with axes and content areas
 * @param {HTMLElement} container - Chart container
 * @param {Object} config - Chart configuration
 * @returns {Object} SVG elements for rendering
 */
function createDomStructure(container, config) {
  const { margin, fullChartHeight, needsScrolling } = config;

  // Clear existing content
  container.innerHTML = "";

  // Create axis container (fixed at top)
  const xAxisContainer = document.createElement("div");
  xAxisContainer.className = "viz-axis-container";

  // Create scrollable content area
  const scrollContainer = document.createElement("div");
  scrollContainer.className = "viz-bar-scroll";
  Object.assign(scrollContainer.style, {
    position: "absolute",
    top: `${margin.top}px`,
    bottom: "20px",
    left: "0",
    right: "0",
    overflowY: needsScrolling ? "auto" : "hidden",
    overflowX: "hidden",
  });

  // Append containers
  container.appendChild(xAxisContainer);
  container.appendChild(scrollContainer);

  // Create SVGs
  const svg = d3
    .select(scrollContainer)
    .append("svg")
    .attr("class", "viz-bar-canvas")
    .attr("width", "100%")
    .attr("height", fullChartHeight - margin.top)
    .attr("preserveAspectRatio", "xMinYMin meet");

  const xAxisSvg = d3
    .select(xAxisContainer)
    .append("svg")
    .attr("class", "viz-axis-canvas")
    .attr("width", "100%")
    .attr("height", margin.top)
    .attr("preserveAspectRatio", "xMinYMin meet");

  return { svg, xAxisSvg };
}

/**
 * Creates scales for chart axes
 * @param {Array} dataset - Data to visualize
 * @param {string} measure - Measure field name
 * @param {Object} config - Chart configuration
 * @returns {Object} x and y scales
 */
function createScales(dataset, measure, config) {
  const { margin, containerWidth, fullChartHeight } = config;

  // Calculate maximum value with fallback
  const maxValue = d3.max(dataset, (d) => +d[measure] || 0);

  // Create x scale with 5% padding
  const x = d3
    .scaleLinear()
    .domain([0, maxValue * 1.05])
    .range([margin.left, containerWidth - margin.right])
    .nice();

  // Create y scale (categorical)
  const y = d3
    .scaleBand()
    .domain(d3.range(dataset.length))
    .range([0, fullChartHeight - margin.top - margin.bottom])
    .padding(chartStyles.barChart.bar.padding);

  return { x, y };
}

/**
 * Renders the bars with tooltips
 */
function renderBars(svg, dataset, scales, measure, dimension, config, tooltip) {
  const bars = svg
    .selectAll("rect.bar")
    .data(dataset)
    .join("rect")
    .attr("class", "bar")
    .attr("x", config.margin.left)
    .attr("y", (d, i) => scales.y(i))
    .attr("width", (d) => Math.max(0, scales.x(+d[measure] || 0) - config.margin.left))
    .attr("height", scales.y.bandwidth())
    .attr("fill", config.barColor)
    .attr("rx", chartStyles.barChart.bar.cornerRadius);

  // Attach tooltips with default highlight behavior
  attachMouseTooltip(
    bars,
    tooltip,
    (d) => `
      <strong>${dimension}:</strong> ${d[dimension] || "N/A"}<br>
      <strong>${measure}:</strong> ${formatValue(+d[measure] || 0)}
    `
  );
}

/**
 * Renders value labels next to bars
 */
function renderBarLabels(svg, dataset, scales, measure) {
  svg
    .selectAll("text.bar-label")
    .data(dataset)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => scales.x(+d[measure] || 0) + chartStyles.barChart.valueGap)
    .attr("y", (d, i) => scales.y(i) + scales.y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .attr("fill", chartStyles.colors.text)
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel)
    .style("font-weight", "500")
    .text((d) => formatValue(+d[measure] || 0));
}

/**
 * Renders Y axis with category labels
 */
function renderYAxis(svg, dataset, yScale, dimension, margin) {
  const axis = svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d, i) => truncateLabel(dataset[i]?.[dimension] || "", 25))
        .tickSize(0)
    );

  // Apply styling
  chartStyles.applyAxisStyles(axis, { hideTickLines: true });

  // Add tooltips for truncated labels
  axis
    .selectAll(".tick text")
    .append("title")
    .text((d, i) => dataset[i]?.[dimension] || "");
}

/**
 * Renders X axis with value scale
 */
function renderXAxis(svg, xScale, margin) {
  const axis = svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(xScale).ticks(5).tickFormat(formatValue));

  chartStyles.applyAxisStyles(axis);
}

export default renderBarChart;
