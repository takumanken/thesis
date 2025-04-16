/**
 * Single Bar Chart Component - Simplified Version
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";

/**
 * Renders a single bar chart in the provided container
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderBarChart(container) {
  // Early exits for invalid scenarios
  if (!container) {
    console.error("Container element is null or undefined");
    return;
  }

  if (!state.dataset || !state.dataset.length) {
    container.innerHTML = "<p>No data available to display</p>";
    return;
  }

  // Clear previous content
  container.innerHTML = "";

  // Extract key data from state
  const dataset = state.dataset;
  const dimension = state.aggregationDefinition.dimensions[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Set up chart dimensions
  const margin = { top: 40, right: 20, bottom: 20, left: 200 };
  const barHeight = 25;
  const fullChartHeight = margin.top + margin.bottom + barHeight * dataset.length;
  const displayHeight = Math.min(fullChartHeight, 500);

  // Configure container
  container.style.position = "relative";
  container.style.width = "100%";
  container.style.height = `${displayHeight}px`;

  // Create chart sub-elements
  const { xAxisContainer, scrollContainer, svg, xAxisSvg } = createChartElements(container, margin, fullChartHeight);

  // Create tooltip
  const tooltip = chartStyles.createTooltip();

  // Set up scales
  const containerWidth = container.clientWidth || 800;
  const scales = createScales(dataset, measure, margin, containerWidth, fullChartHeight);

  // Render chart components
  renderBars(svg, dataset, scales, measure, dimension, margin, tooltip);
  renderBarLabels(svg, dataset, scales, measure);
  renderYAxis(svg, dataset, scales.y, dimension, margin);
  renderXAxis(xAxisSvg, scales.x, margin);

  // Add resize handling
  setupResizeHandler(container, dataset, scales, margin, svg, xAxisSvg, measure);
}

/**
 * Create chart DOM elements
 */
function createChartElements(container, margin, fullChartHeight) {
  // X-axis container (fixed at top)
  const xAxisContainer = document.createElement("div");
  xAxisContainer.className = "viz-axis-container";
  container.appendChild(xAxisContainer);

  // Scrollable bars container
  const scrollContainer = document.createElement("div");
  scrollContainer.className = "viz-bar-scroll";
  scrollContainer.style.position = "absolute";
  scrollContainer.style.top = `${margin.top}px`;
  scrollContainer.style.bottom = "20px";
  scrollContainer.style.left = "0";
  scrollContainer.style.right = "0";
  scrollContainer.style.overflowY = "auto";
  scrollContainer.style.overflowX = "hidden";
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

  return { xAxisContainer, scrollContainer, svg, xAxisSvg };
}

/**
 * Create D3 scales based on data
 */
function createScales(dataset, measure, margin, width, fullChartHeight) {
  // X scale for measure values with 5% padding
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
    .padding(0.1);

  return { x, y };
}

/**
 * Render bars with tooltips
 */
function renderBars(svg, dataset, scales, measure, dimension, margin, tooltip) {
  const barColor = "#9EAADB";
  const highlightColor = "#8690BA";

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
    .attr("rx", 2)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", highlightColor);
      chartStyles.showTooltip(
        tooltip,
        event,
        `<strong>${dimension}:</strong> ${d[dimension]}<br>
         <strong>${measure}:</strong> ${formatValue(d[measure])}`
      );
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", barColor);
      chartStyles.hideTooltip(tooltip);
    });
}

/**
 * Render value labels
 */
function renderBarLabels(svg, dataset, scales, measure) {
  svg
    .selectAll("text.bar-label")
    .data(dataset)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => scales.x(d[measure]) + 5)
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
 * Render Y axis (categories)
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
 * Render X axis (values)
 */
function renderXAxis(svg, xScale, margin) {
  const axis = svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(xScale).ticks(5).tickFormat(formatValue));

  chartStyles.applyAxisStyles(axis);
}

/**
 * Set up resize handler
 */
function setupResizeHandler(container, dataset, scales, margin, svg, xAxisSvg, measure) {
  // Clean up any existing observers
  if (container._resizeObserver) {
    container._resizeObserver.disconnect();
  }

  const resizeChart = () => {
    const width = container.clientWidth;
    if (!width) return;

    // Update x scale
    const updatedX = scales.x.copy().range([margin.left, width - margin.right]);

    // Update bar widths
    svg.selectAll("rect.bar").attr("width", (d) => Math.max(0, updatedX(d[measure]) - margin.left));

    // Update labels
    svg.selectAll("text.bar-label").attr("x", (d) => updatedX(d[measure]) + 5);

    // Update x-axis
    xAxisSvg.select(".x-axis").call(d3.axisTop(updatedX).ticks(5).tickFormat(formatValue));

    chartStyles.applyAxisStyles(xAxisSvg.select(".x-axis"));
  };

  // Observe resizing
  const observer = new ResizeObserver(debounce(resizeChart, 250));
  observer.observe(container);
  container._resizeObserver = observer;

  // Initial render
  resizeChart();
}

/**
 * Utility functions
 */
function truncateLabel(text, maxLength = 25) {
  return text?.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function formatValue(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return value.toLocaleString();
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export default renderBarChart;
