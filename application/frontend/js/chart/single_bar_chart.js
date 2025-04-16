/**
 * Single Bar Chart Component
 * Renders a horizontal bar chart with scroll functionality for large datasets
 */
import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js";

/**
 * Renders a single bar chart in the provided container
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderBarChart(container) {
  // Check for valid data
  if (!state.dataset || !state.dataset.length) {
    container.innerHTML = "<p>No data available to display</p>";
    return;
  }

  // Clear previous content
  container.innerHTML = "";

  // Get data properties from state
  const dataset = state.dataset;
  const dimension = state.aggregationDefinition.dimensions[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Initialize chart configuration
  const config = createChartConfig(dataset.length);

  // Create responsive chart structure
  const chartElements = createChartStructure(container, config);

  // Setup scales based on data
  const scales = createScales(dataset, measure, config);

  // Render chart elements
  renderChartElements(chartElements, dataset, scales, dimension, measure, config);
}

/**
 * Creates chart configuration settings
 * @param {number} dataLength - Length of the dataset
 * @returns {Object} Chart configuration object
 */
function createChartConfig(dataLength) {
  const margin = {
    top: 40,
    right: 20,
    bottom: 20,
    left: 200,
  };

  const barHeight = 25;
  const chartWidth = "100%"; // Responsive width
  const fullChartHeight = margin.top + margin.bottom + barHeight * dataLength;
  const minHeight = 400; // Minimum chart height

  return {
    margin,
    barHeight,
    width: chartWidth,
    totalHeight: Math.max(minHeight, fullChartHeight),
    fullChartHeight,
    minHeight,
  };
}

/**
 * Creates the chart DOM structure
 * @param {HTMLElement} container - Parent container
 * @param {Object} config - Chart configuration
 * @returns {Object} References to chart elements
 */
function createChartStructure(container, config) {
  // Main chart container - responsive by default
  const chartContainer = document.createElement("div");
  chartContainer.className = "single-bar-chart";
  chartContainer.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    min-height: ${config.minHeight}px;
  `;
  container.appendChild(chartContainer);

  // Fixed header for x-axis
  const xAxisContainer = document.createElement("div");
  xAxisContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: ${config.margin.top}px;
    z-index: 2;
  `;
  chartContainer.appendChild(xAxisContainer);

  // Scrollable container for bars
  const scrollContainer = document.createElement("div");
  scrollContainer.style.cssText = `
    position: absolute;
    top: ${config.margin.top}px;
    left: 0;
    right: 0;
    bottom: 0;
    overflow-y: auto;
    overflow-x: hidden;
  `;
  chartContainer.appendChild(scrollContainer);

  // SVG elements
  const svg = d3
    .select(scrollContainer)
    .append("svg")
    .attr("width", "100%")
    .attr("height", config.fullChartHeight - config.margin.top)
    .attr("preserveAspectRatio", "xMinYMin meet");

  const xAxisSvg = d3
    .select(xAxisContainer)
    .append("svg")
    .attr("width", "100%")
    .attr("height", config.margin.top)
    .attr("preserveAspectRatio", "xMinYMin meet");

  // Create tooltip
  const tooltip = chartStyles.createTooltip();

  return {
    chartContainer,
    xAxisContainer,
    scrollContainer,
    svg,
    xAxisSvg,
    tooltip,
  };
}

/**
 * Creates D3 scales for the chart
 * @param {Array} dataset - The chart data
 * @param {string} measure - Measure field name
 * @param {Object} config - Chart configuration
 * @returns {Object} x and y scales
 */
function createScales(dataset, measure, config) {
  // Get container width for responsive scaling
  const containerWidth = document.querySelector(".chart-container").clientWidth;
  const effectiveWidth = containerWidth || 800; // Fallback width

  // X scale (horizontal) for measure values
  const xMax = d3.max(dataset, (d) => d[measure]) * 1.05; // Add 5% padding
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([config.margin.left, effectiveWidth - config.margin.right])
    .nice();

  // Y scale (vertical) for dimension categories
  const y = d3
    .scaleBand()
    .domain(d3.range(dataset.length))
    .range([0, config.fullChartHeight - config.margin.top - config.margin.bottom])
    .padding(0.1);

  return { x, y };
}

/**
 * Renders all chart elements
 * @param {Object} elements - Chart DOM elements
 * @param {Array} dataset - The chart data
 * @param {Object} scales - D3 scales
 * @param {string} dimension - Dimension field name
 * @param {string} measure - Measure field name
 * @param {Object} config - Chart configuration
 */
function renderChartElements(elements, dataset, scales, dimension, measure, config) {
  renderBars(elements.svg, dataset, scales, measure, dimension, config.margin, elements.tooltip);
  renderBarLabels(elements.svg, dataset, scales, measure);
  renderYAxis(elements.svg, dataset, scales.y, dimension, config.margin);
  renderXAxis(elements.xAxisSvg, scales.x, config.margin);

  // Update on window resize for responsiveness
  addResizeHandler(elements, dataset, scales, dimension, measure, config);
}

/**
 * Renders the bars with tooltips
 * @param {Object} svg - D3 SVG selection
 * @param {Array} dataset - The chart data
 * @param {Object} scales - D3 scales
 * @param {string} measure - Measure field name
 * @param {string} dimension - Dimension field name
 * @param {Object} margin - Chart margins
 * @param {HTMLElement} tooltip - Tooltip element
 */
function renderBars(svg, dataset, scales, measure, dimension, margin, tooltip) {
  svg
    .selectAll("rect.bar")
    .data(dataset)
    .join("rect")
    .attr("class", "bar")
    .attr("x", margin.left)
    .attr("y", (d, i) => scales.y(i))
    .attr("width", (d) => Math.max(0, scales.x(d[measure]) - margin.left)) // Prevent negative width
    .attr("height", scales.y.bandwidth())
    .attr("fill", chartStyles.colors.primary)
    .attr("rx", 2) // Rounded corners
    .on("mouseover", function (event, d) {
      // Highlight bar
      d3.select(this).attr("fill", chartStyles.colors.highlight);

      // Show tooltip with formatted values
      chartStyles.showTooltip(
        tooltip,
        event,
        `<strong>${dimension}:</strong> ${d[dimension]}<br>
         <strong>${measure}:</strong> ${formatValue(d[measure])}`
      );
    })
    .on("mouseout", function () {
      // Reset bar color
      d3.select(this).attr("fill", chartStyles.colors.primary);
      chartStyles.hideTooltip(tooltip);
    });
}

/**
 * Renders value labels on bars
 * @param {Object} svg - D3 SVG selection
 * @param {Array} dataset - The chart data
 * @param {Object} scales - D3 scales
 * @param {string} measure - Measure field name
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
 * Renders the Y axis (categories)
 * @param {Object} svg - D3 SVG selection
 * @param {Array} dataset - The chart data
 * @param {Function} yScale - D3 y scale
 * @param {string} dimension - Dimension field name
 * @param {Object} margin - Chart margins
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

  // Add full text as title for truncated labels
  axis
    .selectAll(".tick text")
    .append("title")
    .text((d, i) => dataset[i][dimension]);
}

/**
 * Renders the X axis (values)
 * @param {Object} svg - D3 SVG selection
 * @param {Function} xScale - D3 x scale
 * @param {Object} margin - Chart margins
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
 * Adds resize handler for responsiveness
 * @param {Object} elements - Chart DOM elements
 * @param {Array} dataset - The chart data
 * @param {Object} scales - D3 scales
 * @param {string} dimension - Dimension field name
 * @param {string} measure - Measure field name
 * @param {Object} config - Chart configuration
 */
function addResizeHandler(elements, dataset, scales, dimension, measure, config) {
  const resizeChart = () => {
    // Get updated container width
    const containerWidth = elements.chartContainer.clientWidth;
    if (!containerWidth) return;

    // Update x scale with new width
    const updatedX = scales.x.copy().range([config.margin.left, containerWidth - config.margin.right]);

    // Update bars
    elements.svg.selectAll("rect.bar").attr("width", (d) => Math.max(0, updatedX(d[measure]) - config.margin.left));

    // Update labels
    elements.svg.selectAll("text.bar-label").attr("x", (d) => updatedX(d[measure]) + 5);

    // Update x-axis
    elements.xAxisSvg.select(".x-axis").call(d3.axisTop(updatedX).ticks(5).tickFormat(formatValue));

    chartStyles.applyAxisStyles(elements.xAxisSvg.select(".x-axis"));
  };

  // Initial call for first render
  resizeChart();

  // Add event listener
  const resizeObserver = new ResizeObserver(debounce(resizeChart, 250));
  resizeObserver.observe(elements.chartContainer);

  // Store observer reference for cleanup
  elements.chartContainer._resizeObserver = resizeObserver;
}

/**
 * Utility function to truncate long text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncating
 * @returns {string} Truncated text
 */
function truncateLabel(text, maxLength = 25) {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

/**
 * Format numerical values for display
 * @param {number} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
}

/**
 * Debounce function for resize events
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export default renderBarChart;
