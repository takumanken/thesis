/**
 * Single Bar Chart Component
 * Displays categorical data with a single measure as horizontal bars
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import * as chartUtils from "./utils/chartUtils.js";
import * as chartScales from "./utils/chartScales.js";
import * as chartAxes from "./utils/chartAxes.js";

// -------------------------------------------------------------------------
// CHART DESIGN PARAMETERS
// -------------------------------------------------------------------------
const CHART_DESIGN = {
  barHeight: 18, // Height of each bar in pixels
  rowSpacing: 25, // Space between rows in pixels
  cornerRadius: 0, // Rounded corner radius
  maxChartHeight: 650, // Maximum overall chart height
  valueGap: 5, // Gap between bar and value label
  labelMaxLength: 25, // Maximum length for category labels
};
// -------------------------------------------------------------------------

/**
 * Main render function for single bar chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderBarChart(container) {
  if (!chartUtils.validateRenderingContext(container)) return;

  // Extract data and create configuration
  const { dataset, dimension, measure } = extractChartData();
  const config = setupChartConfiguration(container, dataset);

  // Setup DOM structure and create visualization components
  const svg = createDomStructure(container, config);
  const scales = createScales(dataset, measure, config);
  const tooltip = chartStyles.createTooltip();

  // Render all chart components
  renderBars(svg, dataset, scales, measure, dimension, config, tooltip);
  renderBarLabels(svg, dataset, scales, measure, config);
  renderYAxis(svg, dataset, scales.y, dimension, config.margin, config);

  // Setup resize handling
  chartUtils.setupResizeHandler(container, () => renderBarChart(container));
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
  margin.top = 15;

  // Use CHART_DESIGN parameters for consistent bar heights
  const barHeight = CHART_DESIGN.barHeight;
  const rowSpacing = CHART_DESIGN.rowSpacing;
  const rowHeight = barHeight + rowSpacing;
  const containerWidth = container.clientWidth || 800;

  // Calculate dimensions based on data and row height
  const dataLength = dataset?.length || 0;
  const contentHeight = rowHeight * dataLength;
  const fullChartHeight = margin.top + margin.bottom + contentHeight;
  const displayHeight = Math.min(fullChartHeight, CHART_DESIGN.maxChartHeight);

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
    barHeight,
    rowHeight,
    rowSpacing,
    needsScrolling: fullChartHeight > displayHeight,
    barColor: chartColors.sequential.blue.base,
  };
}

/**
 * Creates chart DOM structure with content area
 * @param {HTMLElement} container - Chart container
 * @param {Object} config - Chart configuration
 * @returns {Object} SVG element for rendering
 */
function createDomStructure(container, config) {
  // Clear existing content
  container.innerHTML = "";

  // Create scrollable content area
  const scrollContainer = document.createElement("div");
  scrollContainer.className = "viz-bar-scroll";
  Object.assign(scrollContainer.style, {
    position: "absolute",
    top: "0",
    bottom: "0",
    left: "0",
    right: "0",
    overflowY: config.needsScrolling ? "auto" : "hidden",
    overflowX: "hidden",
  });

  // Append container
  container.appendChild(scrollContainer);

  // Create SVG
  const svg = d3
    .select(scrollContainer)
    .append("svg")
    .attr("class", "viz-bar-canvas")
    .attr("width", "100%")
    .attr("height", config.fullChartHeight)
    .attr("preserveAspectRatio", "xMinYMin meet");

  return svg;
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

  // Use fixed step size for Y scale similar to stacked bar chart
  const yDomain = d3.range(dataset.length);
  const yStep = config.rowHeight;
  const yRange = [margin.top, margin.top + yStep * yDomain.length];

  return {
    // Use createMeasureScale for x-axis
    x: chartScales.createMeasureScale(dataset, measure, [margin.left, containerWidth - margin.right]),

    // Use scalePoint for y-axis with fixed step size
    y: d3
      .scalePoint()
      .domain(yDomain)
      .range(yRange)
      .padding(0.5) // Center points
      .round(true), // Round to pixel values
  };
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
    .attr("y", (d, i) => scales.y(i) - config.barHeight / 2) // Center bars on y position
    .attr("width", (d) => Math.max(0, scales.x(+d[measure] || 0) - config.margin.left))
    .attr("height", config.barHeight) // Use fixed bar height
    .attr("fill", config.barColor)
    .attr("rx", CHART_DESIGN.cornerRadius); // Use CHART_DESIGN value

  // Attach tooltips
  chartUtils.attachMouseTooltip(
    bars,
    tooltip,
    (d) => `
      <strong>${chartUtils.getDisplayName(dimension)}:</strong> ${d[dimension] || "N/A"}<br>
      <strong>${chartUtils.getDisplayName(measure)}:</strong> ${chartUtils.formatValue(+d[measure] || 0)}
    `
  );
}

/**
 * Renders value labels next to bars
 */
function renderBarLabels(svg, dataset, scales, measure, config) {
  svg
    .selectAll("text.bar-label")
    .data(dataset)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => scales.x(+d[measure] || 0) + CHART_DESIGN.valueGap) // Use CHART_DESIGN value
    .attr("y", (d, i) => scales.y(i)) // Center on point
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .attr("fill", chartStyles.colors.text)
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel)
    .style("font-weight", "500")
    .text((d) => chartUtils.formatValue(+d[measure] || 0));
}

/**
 * Renders Y axis with category labels
 */
function renderYAxis(svg, dataset, yScale, dimension, margin) {
  chartAxes.renderCategoryAxis(svg, yScale, dataset, {
    orientation: "left",
    position: { x: margin.left, y: 0 },
    labelField: dimension,
    maxLabelLength: CHART_DESIGN.labelMaxLength,
    showTickLines: false,
    className: "y-axis",
  });
}

export default renderBarChart;
