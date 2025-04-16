/**
 * Single Bar Chart Component
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { truncateLabel, formatValue, setupResizeHandler } from "./utils/chartUtils.js";

/**
 * Renders a single bar chart in the provided container
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderBarChart(container) {
  // Validate and prepare
  if (!isValidRenderingContext(container)) return;

  // Extract data and dimensions
  const { dataset, dimension, measure } = extractChartData();

  // Configure container and layout
  const { margin, displayHeight, fullChartHeight } = setupChartDimensions(container, dataset);

  // Create DOM structure
  const elements = createChartStructure(container, margin, fullChartHeight);
  const tooltip = chartStyles.createTooltip();

  // Create scales
  const containerWidth = container.clientWidth || 800;
  const scales = createScales(dataset, measure, margin, containerWidth, fullChartHeight);

  // Render chart elements
  renderChartComponents(elements, dataset, scales, measure, dimension, margin, tooltip);

  // Setup event handlers
  setupResizeHandler(container, () => renderBarChart(container));
}

/**
 * Validates rendering context
 */
function isValidRenderingContext(container) {
  if (!container) {
    console.error("Container element is null or undefined");
    return false;
  }

  if (!state.dataset?.length) {
    if (container) container.innerHTML = "<p>No data available to display</p>";
    return false;
  }

  container.innerHTML = "";
  return true;
}

/**
 * Extracts chart data from state
 */
function extractChartData() {
  const dataset = state.dataset;
  const dimension = state.aggregationDefinition.dimensions[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  return { dataset, dimension, measure };
}

/**
 * Sets up chart dimensions and configures container
 */
function setupChartDimensions(container, dataset) {
  const margin = chartStyles.getChartMargins("horizontal_bar_chart");
  const barHeight = chartStyles.barChart.bar.height;
  const fullChartHeight = margin.top + margin.bottom + barHeight * dataset.length;
  const displayHeight = Math.min(fullChartHeight, chartStyles.barChart.maxHeight);

  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${displayHeight}px`,
  });

  return { margin, displayHeight, fullChartHeight };
}

/**
 * Creates the DOM structure for the chart
 */
function createChartStructure(container, margin, fullChartHeight) {
  // X-axis container
  const xAxisContainer = document.createElement("div");
  xAxisContainer.className = "viz-axis-container";
  container.appendChild(xAxisContainer);

  // Scrollable content
  const scrollContainer = document.createElement("div");
  scrollContainer.className = "viz-bar-scroll";

  Object.assign(scrollContainer.style, {
    position: "absolute",
    top: `${margin.top}px`,
    bottom: "20px",
    left: "0",
    right: "0",
    overflowY: "auto",
    overflowX: "hidden",
  });

  container.appendChild(scrollContainer);

  // SVG elements
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
 * Creates scales for both axes
 */
function createScales(dataset, measure, margin, width, fullChartHeight) {
  // X scale with padding
  const xMax = d3.max(dataset, (d) => d[measure]) * 1.05;
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([margin.left, width - margin.right])
    .nice();

  // Y scale for categories
  const y = d3
    .scaleBand()
    .domain(d3.range(dataset.length))
    .range([0, fullChartHeight - margin.top - margin.bottom])
    .padding(chartStyles.barChart.bar.padding);

  return { x, y };
}

/**
 * Renders all chart components
 */
function renderChartComponents(elements, dataset, scales, measure, dimension, margin, tooltip) {
  const { svg, xAxisSvg } = elements;

  renderBars(svg, dataset, scales, measure, dimension, margin, tooltip);
  renderBarLabels(svg, dataset, scales, measure);
  renderYAxis(svg, dataset, scales.y, dimension, margin);
  renderXAxis(xAxisSvg, scales.x, margin);
}

/**
 * Renders the bars with tooltips
 */
function renderBars(svg, dataset, scales, measure, dimension, margin, tooltip) {
  const barColor = chartColors.sequential.blue.base;
  const highlightColor = d3.color(barColor).darker(0.2);

  svg
    .selectAll("rect.bar")
    .data(dataset)
    .join("rect")
    .attr("class", "bar")
    .attr("x", margin.left)
    .attr("y", (d, i) => scales.y(i))
    .attr("width", (d) => Math.max(0, scales.x(d[measure]) - margin.left))
    .attr("height", scales.y.bandwidth())
    .attr("fill", barColor)
    .attr("rx", chartStyles.barChart.bar.cornerRadius)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", highlightColor);
      chartStyles.showTooltip(tooltip, event, formatTooltip(d, dimension, measure));
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", barColor);
      chartStyles.hideTooltip(tooltip);
    });
}

/**
 * Formats tooltip content
 */
function formatTooltip(d, dimension, measure) {
  return `
    <strong>${dimension}:</strong> ${d[dimension]}<br>
    <strong>${measure}:</strong> ${formatValue(d[measure])}
  `;
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
    .attr("x", (d) => scales.x(d[measure]) + chartStyles.barChart.valueGap)
    .attr("y", (d, i) => scales.y(i) + scales.y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .attr("fill", chartStyles.colors?.text || "#333")
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel)
    .style("font-weight", "500")
    .text((d) => formatValue(d[measure]));
}

/**
 * Renders the Y axis (categories)
 */
function renderYAxis(svg, dataset, yScale, dimension, margin) {
  const axis = svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d, i) => truncateLabel(dataset[i][dimension], 25))
        .tickSize(0)
    );

  chartStyles.applyAxisStyles(axis);

  // Add tooltips for truncated labels
  axis
    .selectAll(".tick text")
    .append("title")
    .text((d, i) => dataset[i][dimension]);
}

/**
 * Renders the X axis (values)
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
