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
  barHeight: 15, // Height of each bar in pixels
  rowSpacing: 5, // Space between rows in pixels
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
  // Reduce top margin since we're removing the x-axis
  margin.top = 15;

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
 * Creates chart DOM structure with content area
 * @param {HTMLElement} container - Chart container
 * @param {Object} config - Chart configuration
 * @returns {Object} SVG element for rendering
 */
function createDomStructure(container, config) {
  const { margin, fullChartHeight, needsScrolling } = config;

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
    overflowY: needsScrolling ? "auto" : "hidden",
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
    .attr("height", fullChartHeight)
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

  return {
    // Use createMeasureScale for x-axis
    x: chartScales.createMeasureScale(dataset, measure, [margin.left, containerWidth - margin.right]),

    // Use createCategoryScale for y-axis (index-based)
    y: chartScales.createCategoryScale(
      d3.range(dataset.length),
      [margin.top, fullChartHeight - margin.bottom],
      chartStyles.barChart.bar.padding
    ),
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
    .attr("y", (d, i) => scales.y(i))
    .attr("width", (d) => Math.max(0, scales.x(+d[measure] || 0) - config.margin.left))
    .attr("height", scales.y.bandwidth())
    .attr("fill", config.barColor)
    .attr("rx", chartStyles.barChart.bar.cornerRadius);

  // Attach tooltips with default highlight behavior and translated field names
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
    .attr("x", (d) => scales.x(+d[measure] || 0) + chartStyles.barChart.valueGap)
    .attr("y", (d, i) => scales.y(i) + scales.y.bandwidth() / 2)
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
    maxLabelLength: 25,
    showTickLines: false,
    className: "y-axis",
  });
}

export default renderBarChart;
