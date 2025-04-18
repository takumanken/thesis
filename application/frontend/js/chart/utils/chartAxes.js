/**
 * Unified axis rendering utilities for all chart types
 */
import { chartStyles } from "./chartStyles.js";
import { formatValue, truncateLabel, formatTimeValue, determineTimeGrain } from "./chartUtils.js";

/**
 * Renders a measure axis with value formatting
 * @param {d3.Selection} svg - SVG element to add axis to
 * @param {d3.Scale} scale - D3 scale to use
 * @param {Object} options - Configuration options
 * @returns {d3.Selection} The created axis
 */
export function renderMeasureAxis(svg, scale, options = {}) {
  const {
    orientation = "left", // left, right, top, bottom
    position = { x: 0, y: 0 },
    tickCount = 5,
    tickFormat = formatValue,
    isPercentage = false,
    className = "measure-axis",
  } = options;

  // Determine axis generator based on orientation
  let axisGenerator;
  switch (orientation) {
    case "right":
      axisGenerator = d3.axisRight(scale);
      break;
    case "top":
      axisGenerator = d3.axisTop(scale);
      break;
    case "bottom":
      axisGenerator = d3.axisBottom(scale);
      break;
    case "left":
    default:
      axisGenerator = d3.axisLeft(scale);
  }

  // Configure ticks
  axisGenerator
    .ticks(tickCount)
    .tickFormat(isPercentage ? (d) => `${(d * (isPercentage === "normalized" ? 100 : 1)).toFixed(0)}%` : tickFormat);

  // Create and position axis
  const axis = svg
    .append("g")
    .attr("class", className)
    .attr("transform", `translate(${position.x}, ${position.y})`)
    .call(axisGenerator);

  // Apply standard styling
  chartStyles.applyAxisStyles(axis, options);

  return axis;
}

/**
 * Renders a category axis for dimensions
 * @param {d3.Selection} svg - SVG element to add axis to
 * @param {d3.Scale} scale - D3 scale to use
 * @param {Array} data - Dataset for retrieving category labels
 * @param {Object} options - Configuration options
 * @returns {d3.Selection} The created axis
 */
export function renderCategoryAxis(svg, scale, data, options = {}) {
  const {
    orientation = "left", // left, right, top, bottom
    position = { x: 0, y: 0 },
    labelField = "category",
    maxLabelLength = 25,
    showTickLines = false,
    className = "category-axis",
  } = options;

  // Determine axis generator
  let axisGenerator;
  switch (orientation) {
    case "right":
      axisGenerator = d3.axisRight(scale);
      break;
    case "top":
      axisGenerator = d3.axisTop(scale);
      break;
    case "bottom":
      axisGenerator = d3.axisBottom(scale);
      break;
    case "left":
    default:
      axisGenerator = d3.axisLeft(scale);
  }

  // Configure tick format based on use case
  if (typeof scale.domain()[0] === "number") {
    // Handle index-based scales (like in single_bar_chart)
    axisGenerator.tickFormat((d, i) => truncateLabel(data[i]?.[labelField] || "", maxLabelLength));
  }

  if (!showTickLines) {
    axisGenerator.tickSize(0);
  }

  // Create and position axis
  const axis = svg
    .append("g")
    .attr("class", className)
    .attr("transform", `translate(${position.x}, ${position.y})`)
    .call(axisGenerator);

  // Apply standard styling
  chartStyles.applyAxisStyles(axis, { hideTickLines: !showTickLines });

  // Add tooltips for truncated labels if using index-based scale
  if (typeof scale.domain()[0] === "number") {
    axis
      .selectAll(".tick text")
      .append("title")
      .text((d, i) => data[i]?.[labelField] || "");
  }

  return axis;
}

/**
 * Creates a vertical or horizontal reference line
 * @param {d3.Selection} svg - SVG element to add line to
 * @param {Object} options - Line configuration
 * @returns {d3.Selection} The created line
 */
export function createReferenceLine(svg, options = {}) {
  const {
    orientation = "horizontal", // horizontal or vertical
    position = 0,
    start = 0,
    end = 100,
    stroke = chartStyles.colors.axisLine,
    strokeWidth = 1,
    strokeDasharray = null,
    className = "reference-line",
  } = options;

  const line = svg
    .append("line")
    .attr("class", className)
    .attr("x1", orientation === "horizontal" ? start : position)
    .attr("y1", orientation === "horizontal" ? position : start)
    .attr("x2", orientation === "horizontal" ? end : position)
    .attr("y2", orientation === "horizontal" ? position : end)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth)
    .attr("shape-rendering", "crispEdges");

  if (strokeDasharray) {
    line.attr("stroke-dasharray", strokeDasharray);
  }

  return line;
}

/**
 * Get X axis tick settings based on time grain
 * @param {d3.Scale} xScale - The x axis scale
 * @param {boolean} isNumericTime - Whether time is numeric (vs. date)
 * @param {string} timeGrain - Time grain (year, month, week, day)
 * @returns {Object} Formatting settings for x-axis
 */
export function getTimeAxisSettings(xScale, isNumericTime, timeGrain) {
  let tickFormat;
  let rotateLabels = false;
  let tickCount;

  if (isNumericTime) {
    tickFormat = d3.format("d");
  } else {
    switch (timeGrain) {
      case "year":
        tickFormat = d3.timeFormat("%Y");
        break;
      case "month":
        tickFormat = d3.timeFormat("%b %Y");
        break;
      case "week":
        tickFormat = d3.timeFormat("%b %d");
        rotateLabels = true;
        break;
      case "day":
      default:
        tickFormat = d3.timeFormat("%Y-%m-%d");
        rotateLabels = true;
        break;
    }

    // Calculate appropriate tick count for date scales
    const domain = xScale.domain();
    const timeSpan = domain[1] - domain[0];

    if (timeGrain === "year") {
      tickCount = Math.min(10, Math.ceil(timeSpan / (365 * 24 * 60 * 60 * 1000)));
    } else if (timeGrain === "month") {
      tickCount = Math.min(12, Math.ceil(timeSpan / (30 * 24 * 60 * 60 * 1000)));
    } else if (timeGrain === "week") {
      tickCount = Math.min(15, Math.ceil(timeSpan / (7 * 24 * 60 * 60 * 1000)));
    } else {
      // For days, limit to reasonable number
      tickCount = Math.min(15, Math.ceil(timeSpan / (24 * 60 * 60 * 1000)));
    }
  }

  return { tickFormat, rotateLabels, tickCount };
}

/**
 * Render X axis with appropriate time formatting
 * @param {d3.Selection} svg - SVG element to add axis to
 * @param {d3.Scale} xScale - The x scale
 * @param {number} height - Height for positioning
 * @param {boolean} isNumericTime - Whether time is numeric
 * @param {string} timeGrain - Time grain (year, month, week, day)
 * @returns {d3.Selection} The created axis
 */
export function renderTimeAxis(svg, xScale, height, isNumericTime, timeGrain) {
  const { tickFormat, rotateLabels, tickCount } = getTimeAxisSettings(xScale, isNumericTime, timeGrain);

  // Create axis generator
  const axisGenerator = d3.axisBottom(xScale).tickFormat(tickFormat);

  // Set tick count if provided
  if (tickCount) {
    axisGenerator.ticks(tickCount);
  }

  // Add and style axis
  const axis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(axisGenerator);

  // Style labels
  axis
    .selectAll("text")
    .attr("dx", rotateLabels ? "-.8em" : 0)
    .attr("dy", rotateLabels ? ".15em" : ".35em")
    .attr("transform", rotateLabels ? "rotate(-45)" : null)
    .style("text-anchor", rotateLabels ? "end" : "middle");

  // Apply standard styling
  chartStyles.applyAxisStyles(axis);

  return axis;
}
