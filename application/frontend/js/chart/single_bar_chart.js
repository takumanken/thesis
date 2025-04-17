/**
 * Single Bar Chart Component
 * Displays categorical data with a single measure as horizontal bars
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { truncateLabel, formatValue, setupResizeHandler, validateRenderingContext } from "./utils/chartUtils.js";

/**
 * Main render function for single bar chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderBarChart(container) {
  // Validate input and environment
  if (!validateRenderingContext(container)) return;

  // Get data and configuration
  const { dataset, dimension, measure } = extractChartData();
  const config = setupChartConfiguration(container, dataset);

  // Create DOM structure and scales
  const elements = createDomStructure(container, config);
  const scales = createScales(dataset, measure, config);
  const tooltip = chartStyles.createTooltip();

  // Render chart components
  renderChart(elements, dataset, scales, dimension, measure, config, tooltip);

  // Setup resize handling
  setupResizeHandler(container, () => renderBarChart(container));
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
 * Sets up chart configuration
 */
function setupChartConfiguration(container, dataset) {
  // Get dimensions
  const margin = chartStyles.getChartMargins("horizontal_bar_chart");
  const barHeight = chartStyles.barChart.bar.height;
  const containerWidth = container.clientWidth || 800;

  // Calculate heights
  const fullChartHeight = margin.top + margin.bottom + barHeight * dataset.length;
  const displayHeight = Math.min(fullChartHeight, chartStyles.barChart.maxHeight);
  const needsScrolling = fullChartHeight > displayHeight;

  // Configure container
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
    needsScrolling,
    barColor: chartColors.sequential.blue.base,
  };
}

/**
 * Creates DOM structure for chart
 */
function createDomStructure(container, config) {
  // X-axis container (fixed at top)
  const xAxisContainer = document.createElement("div");
  xAxisContainer.className = "viz-axis-container";
  container.appendChild(xAxisContainer);

  // Scrollable content area
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
  container.appendChild(scrollContainer);

  // Create SVG elements
  const svg = d3
    .select(scrollContainer)
    .append("svg")
    .attr("class", "viz-bar-canvas")
    .attr("width", "100%")
    .attr("height", config.fullChartHeight - config.margin.top)
    .attr("preserveAspectRatio", "xMinYMin meet");

  const xAxisSvg = d3
    .select(xAxisContainer)
    .append("svg")
    .attr("class", "viz-axis-canvas")
    .attr("width", "100%")
    .attr("height", config.margin.top)
    .attr("preserveAspectRatio", "xMinYMin meet");

  return { svg, xAxisSvg };
}

/**
 * Creates scales for chart axes
 */
function createScales(dataset, measure, config) {
  const { margin, containerWidth, fullChartHeight } = config;

  // Create x scale with 5% padding
  const maxValue = d3.max(dataset, (d) => d[measure]) || 0;
  const x = d3
    .scaleLinear()
    .domain([0, maxValue * 1.05])
    .range([margin.left, containerWidth - margin.right])
    .nice();

  // Create y scale for categories
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
function renderChart(elements, dataset, scales, dimension, measure, config, tooltip) {
  renderBars(elements.svg, dataset, scales, measure, dimension, config, tooltip);
  renderBarLabels(elements.svg, dataset, scales, measure);
  renderYAxis(elements.svg, dataset, scales.y, dimension, config.margin);
  renderXAxis(elements.xAxisSvg, scales.x, config.margin);
}

/**
 * Renders bars with tooltips
 */
function renderBars(svg, dataset, scales, measure, dimension, config, tooltip) {
  const barColor = config.barColor;
  const highlightColor = d3.color(barColor).darker(0.2);

  svg
    .selectAll("rect.bar")
    .data(dataset)
    .join("rect")
    .attr("class", "bar")
    .attr("x", config.margin.left)
    .attr("y", (d, i) => scales.y(i))
    .attr("width", (d) => Math.max(0, scales.x(d[measure]) - config.margin.left))
    .attr("height", scales.y.bandwidth())
    .attr("fill", barColor)
    .attr("rx", chartStyles.barChart.bar.cornerRadius)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", highlightColor);
      const tooltipContent = `
        <strong>${dimension}:</strong> ${d[dimension]}<br>
        <strong>${measure}:</strong> ${formatValue(d[measure])}
      `;
      chartStyles.tooltip.show(tooltip, event, tooltipContent);
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", barColor);
      chartStyles.tooltip.hide(tooltip);
    });
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
    .attr("fill", chartStyles.colors.text)
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel)
    .style("font-weight", "500")
    .text((d) => formatValue(d[measure]));
}

/**
 * Renders Y axis (categories)
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

  // Apply consistent axis styling
  chartStyles.applyAxisStyles(axis, { hideTickLines: true });

  // Add tooltips for truncated labels
  axis
    .selectAll(".tick text")
    .append("title")
    .text((d, i) => dataset[i][dimension]);
}

/**
 * Renders X axis (values)
 */
function renderXAxis(svg, xScale, margin) {
  const axis = svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(xScale).ticks(5).tickFormat(formatValue));

  // Apply consistent axis styling
  chartStyles.applyAxisStyles(axis);
}

export default renderBarChart;
