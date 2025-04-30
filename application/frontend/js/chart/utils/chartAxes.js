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
  let tickCount;

  // Format based on time grain
  if (isNumericTime) {
    tickFormat = d3.format("d");
  } else {
    // Check if data spans multiple years
    const domain = xScale.domain();
    const startYear = domain[0].getFullYear();
    const endYear = domain[1].getFullYear();
    const spansMultipleYears = startYear !== endYear;

    switch (timeGrain) {
      case "year":
        tickFormat = d3.timeFormat("%Y");
        break;
      case "month":
        tickFormat = d3.timeFormat("%b %Y");
        break;
      case "week":
      case "day":
      default:
        // Include year in format if data spans multiple years
        tickFormat = spansMultipleYears
          ? d3.timeFormat("%b %Y") // Jan 23 format
          : d3.timeFormat("%b %Y"); // Jan 23 format
        break;
    }

    // Calculate appropriate tick count based on domain range
    const daysDiff = (domain[1] - domain[0]) / (1000 * 60 * 60 * 24);

    // Determine tick intervals based on date range
    if (timeGrain === "year" || daysDiff > 1825) {
      // > 5 years
      tickCount = d3.timeYear.every(1);
    } else if (daysDiff > 730) {
      // > 2 years
      tickCount = d3.timeMonth.every(3);
    } else if (daysDiff > 180) {
      // > 6 months
      tickCount = d3.timeMonth.every(1);
    } else if (daysDiff > 60) {
      // > 2 months
      tickCount = d3.timeMonth.every(1);
    } else if (daysDiff > 14) {
      // > 2 weeks
      tickCount = d3.timeWeek.every(1);
    } else {
      tickCount = d3.timeDay.every(Math.max(1, Math.floor(daysDiff / 7)));
    }
  }

  return { tickFormat, tickCount };
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
  const { tickFormat, tickCount } = getTimeAxisSettings(xScale, isNumericTime, timeGrain);

  // Create and append axis
  const axisGenerator = d3.axisBottom(xScale).tickFormat(tickFormat);
  if (tickCount) axisGenerator.ticks(tickCount);

  const axis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(axisGenerator);

  // SMART APPROACH: Determine if labels need rotation based on available space
  // Get total width and number of ticks
  const axisWidth = xScale.range()[1] - xScale.range()[0];
  const ticks = axis.selectAll(".tick").nodes();
  const renderedTickCount = ticks.length; // Renamed to avoid redeclaration

  // Check if labels would overlap (estimate average label width based on time grain)
  const avgCharWidth = 8; // Approximate pixel width per character
  let avgLabelWidth;

  if (timeGrain === "year") avgLabelWidth = 4 * avgCharWidth; // "2023"
  else if (timeGrain === "month") avgLabelWidth = 8 * avgCharWidth; // "Jan 2023"
  else if (timeGrain === "week" || timeGrain === "day") avgLabelWidth = 6 * avgCharWidth; // "Jan 15"
  else avgLabelWidth = 8 * avgCharWidth; // Default

  // Calculate available width per tick
  const widthPerTick = axisWidth / renderedTickCount; // Use renamed variable
  const rotateLabels = widthPerTick < avgLabelWidth + 10; // Add padding

  // Apply styling based on calculated rotation
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
