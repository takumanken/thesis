/**
 * Line Chart Component
 * Displays time series data with a single measure over time
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { formatValue, setupResizeHandler, validateRenderingContext, attachMouseTooltip } from "./utils/chartUtils.js";
import { createHorizontalLayout, createColorLegend } from "./utils/legendUtil.js";

// ===== MAIN RENDERING FUNCTION =====

/**
 * Main render function for line chart
 */
function renderLineChart(container) {
  if (!validateRenderingContext(container)) return;

  // Extract dimensions and process data
  const { timeDimension, measure, groupDimension } = extractDimensions();
  const { chartContainer, legendContainer } = setupChartLayout(container, groupDimension);
  const { processedData, uniqueGroups, isNumericTime, timeGrain } = processData(
    state.dataset,
    timeDimension,
    groupDimension
  );

  if (processedData.length === 0) {
    chartContainer.innerHTML = "<p>No valid time data available</p>";
    return;
  }

  // Create chart components
  const config = createChartConfig(chartContainer);
  const svg = createChartElements(chartContainer, config).svg;
  const scales = createScales(processedData, measure, isNumericTime, config);
  const tooltip = chartStyles.createTooltip();
  const lineGenerator = createLineGenerator(scales.x, scales.y, measure);

  // Draw chart components
  drawAxes(svg, scales, config.height, isNumericTime, timeGrain);

  // Draw data and get sorted groups
  const sortedGroups = drawLines({
    svg,
    data: processedData,
    groups: uniqueGroups,
    scales,
    lineGenerator,
    tooltip,
    config,
    timeDimension,
    measure,
    groupDimension,
    isNumericTime,
  });

  // Add legend if grouped data
  if (groupDimension && sortedGroups.length > 0) {
    const colorScale = d3.scaleOrdinal().domain(sortedGroups).range(chartColors.mainPalette);
    createColorLegend(legendContainer, sortedGroups, colorScale);
  }

  // Setup resize handler
  setupResizeHandler(container, () => renderLineChart(container));
}

// ===== DATA EXTRACTION & PROCESSING =====

/**
 * Extract dimensions and measure from state
 */
function extractDimensions() {
  const timeDimension = state.aggregationDefinition.timeDimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Look for grouping dimension
  let groupDimension = null;
  if (state.aggregationDefinition.categoricalDimension?.length > 0) {
    groupDimension = state.aggregationDefinition.categoricalDimension[0];
  } else if (state.aggregationDefinition.geoDimension?.length > 0) {
    groupDimension = state.aggregationDefinition.geoDimension[0];
  }

  return { timeDimension, measure, groupDimension };
}

/**
 * Process and prepare data for visualization
 */
function processData(dataset, timeDimension, groupDimension) {
  const isNumericTime = /_datepart$/.test(timeDimension);
  const timeGrain = determineTimeGrain(timeDimension);

  // Process time values - numeric or date
  const processedData = isNumericTime
    ? processNumericTimeData(dataset, timeDimension)
    : processDateTimeData(dataset, timeDimension);

  // Extract unique groups if grouping is applied
  const uniqueGroups = groupDimension ? [...new Set(processedData.map((d) => d[groupDimension]))] : [];

  return { processedData, uniqueGroups, isNumericTime, timeGrain };
}

/**
 * Process numeric time data (years, quarters)
 */
function processNumericTimeData(dataset, timeDimension) {
  return dataset
    .map((d) => ({
      ...d,
      parsedTime: +d[timeDimension],
    }))
    .filter((d) => !isNaN(d.parsedTime));
}

/**
 * Process date-based time data
 */
function processDateTimeData(dataset, timeDimension) {
  const parseTime = d3.timeParse("%Y-%m-%d");
  return dataset
    .map((d) => ({
      ...d,
      parsedTime: parseTime(d[timeDimension]),
    }))
    .filter((d) => d.parsedTime);
}

/**
 * Determine the time grain from dimension name
 */
function determineTimeGrain(timeDimension) {
  const dimensionLower = timeDimension.toLowerCase();

  if (dimensionLower.includes("year")) return "year";
  if (dimensionLower.includes("month")) return "month";
  if (dimensionLower.includes("week")) return "week";
  return "day";
}

// ===== CHART SETUP FUNCTIONS =====

/**
 * Setup chart layout with chart and legend areas
 */
function setupChartLayout(container, groupDimension) {
  // If grouped, set up horizontal layout with legend
  if (groupDimension) {
    return createHorizontalLayout(container);
  }

  // No grouping - just use container
  container.innerHTML = "";
  return { chartContainer: container, legendContainer: null };
}

/**
 * Create chart configuration with sizing
 */
function createChartConfig(container) {
  const margin = { top: 20, right: 20, bottom: 70, left: 70 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = (container.clientHeight || 500) - margin.top - margin.bottom;

  return { margin, width, height };
}

/**
 * Create chart DOM elements
 */
function createChartElements(container, config) {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "98%")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .append("g")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);

  return { svg };
}

/**
 * Create scales for the chart
 */
function createScales(data, measure, isNumericTime, config) {
  // Create x scale based on data type
  const x = isNumericTime
    ? d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => d.parsedTime))
        .range([0, config.width])
        .nice()
    : d3
        .scaleTime()
        .domain(d3.extent(data, (d) => d.parsedTime))
        .range([0, config.width])
        .nice();

  // Create y scale for measure values
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => +d[measure] || 0) * 1.05])
    .range([config.height, 0])
    .nice();

  return { x, y };
}

/**
 * Create line generator function
 */
function createLineGenerator(x, y, measure) {
  return d3
    .line()
    .x((d) => x(d.parsedTime))
    .y((d) => y(+d[measure] || 0))
    .curve(d3.curveCardinal.tension(0.5));
}

// ===== DRAWING FUNCTIONS =====

/**
 * Draw chart axes
 */
function drawAxes(svg, scales, height, isNumericTime, timeGrain) {
  renderXAxis(svg, scales.x, height, isNumericTime, timeGrain);
  renderYAxis(svg, scales.y);
}

/**
 * Draw lines based on grouping
 */
function drawLines(props) {
  const {
    svg,
    data,
    groups,
    scales,
    lineGenerator,
    tooltip,
    config,
    timeDimension,
    measure,
    groupDimension,
    isNumericTime,
  } = props;

  if (groupDimension && groups.length > 0) {
    // Sort groups by final value
    const sortedGroups = getSortedGroupsByFinalValue(data, groups, groupDimension, measure);

    // Draw grouped lines
    drawGroupedLines({
      svg,
      data,
      groups: sortedGroups,
      scales,
      lineGenerator,
      tooltip,
      config,
      timeDimension,
      measure,
      groupDimension,
      isNumericTime,
    });

    return sortedGroups;
  } else {
    // Draw single line
    drawSingleLine(svg, data, scales, lineGenerator, tooltip, timeDimension, measure, isNumericTime);
    return groups;
  }
}

/**
 * Draw single line chart
 */
function drawSingleLine(svg, data, scales, lineGenerator, tooltip, timeDimension, measure, isNumericTime) {
  // Sort data chronologically
  const sortedData = [...data].sort((a, b) => a.parsedTime - b.parsedTime);

  // Draw the main line
  svg
    .append("path")
    .datum(sortedData)
    .attr("fill", "none")
    .attr("stroke", chartColors.mainPalette[0])
    .attr("stroke-width", 2)
    .attr("d", lineGenerator);

  // Create interactive points
  const points = svg
    .selectAll("circle.point")
    .data(data)
    .join("circle")
    .attr("class", "point")
    .attr("cx", (d) => scales.x(d.parsedTime))
    .attr("cy", (d) => scales.y(+d[measure] || 0))
    .attr("r", 2)
    .attr("fill", chartColors.mainPalette[0])
    .attr("opacity", 0.7);

  // Attach tooltips to points
  attachMouseTooltip(points, tooltip, (d) => {
    const timeValue = isNumericTime ? d.parsedTime : d3.timeFormat("%Y-%m-%d")(d.parsedTime);

    return `
        <strong>${timeDimension}:</strong> ${timeValue}<br>
        <strong>${measure}:</strong> ${formatValue(d[measure])}
      `;
  });
}

/**
 * Draw multiple lines for grouped data
 */
function drawGroupedLines(props) {
  const {
    svg,
    data,
    groups,
    groupDimension,
    scales,
    lineGenerator,
    tooltip,
    config,
    timeDimension,
    measure,
    isNumericTime,
  } = props;

  // Create color scale
  const colorScale = d3.scaleOrdinal().domain(groups).range(chartColors.mainPalette);

  // Group and sort data
  const groupedData = prepareGroupedData(data, groupDimension);

  // Draw lines - one per group
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(groupedData)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d) => colorScale(d.key))
    .attr("stroke-width", 2)
    .attr("d", (d) => lineGenerator(d.values));

  // Add interactive layer
  addInteractionLayer({
    svg,
    groupedData,
    scales,
    colorScale,
    tooltip,
    config,
    timeDimension,
    groupDimension,
    measure,
    isNumericTime,
  });
}

/**
 * Add interactive hover effects to grouped lines
 */
function addInteractionLayer(props) {
  const {
    svg,
    groupedData,
    scales,
    colorScale,
    tooltip,
    config,
    timeDimension,
    groupDimension,
    measure,
    isNumericTime,
  } = props;

  // Create flattened points array
  const allPoints = createPointsArray(groupedData, scales, measure);

  // Create invisible overlay and highlight circle
  const overlay = createOverlay(svg, config);
  const highlight = createHighlightCircle(svg);

  // Add mouse interaction
  setupMouseInteraction(
    overlay,
    highlight,
    allPoints,
    colorScale,
    tooltip,
    timeDimension,
    groupDimension,
    measure,
    isNumericTime
  );
}

/**
 * Create array of all points from grouped data
 */
function createPointsArray(groupedData, scales, measure) {
  const points = [];

  groupedData.forEach((group) => {
    group.values.forEach((d) => {
      points.push({
        x: scales.x(d.parsedTime),
        y: scales.y(+d[measure] || 0),
        data: d,
        group: group.key,
      });
    });
  });

  return points;
}

/**
 * Create invisible overlay for mouse interaction
 */
function createOverlay(svg, config) {
  return svg
    .append("rect")
    .attr("class", "overlay")
    .attr("width", config.width)
    .attr("height", config.height)
    .style("fill", "none")
    .style("pointer-events", "all");
}

/**
 * Create highlight circle for active point
 */
function createHighlightCircle(svg) {
  return svg
    .append("circle")
    .attr("class", "highlight")
    .attr("r", 3)
    .style("fill", "none")
    .style("stroke", "#000")
    .style("stroke-width", 1)
    .style("opacity", 0.5);
}

/**
 * Setup mouse interaction events
 */
function setupMouseInteraction(
  overlay,
  highlight,
  points,
  colorScale,
  tooltip,
  timeDimension,
  groupDimension,
  measure,
  isNumericTime
) {
  overlay
    .on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event);
      const closestPoint = findClosestPoint(mouseX, mouseY, points);

      if (closestPoint && closestPoint.distance < 50) {
        showPointHighlight(
          highlight,
          closestPoint,
          colorScale,
          tooltip,
          event,
          timeDimension,
          groupDimension,
          measure,
          isNumericTime
        );
      } else {
        hidePointHighlight(highlight, tooltip);
      }
    })
    .on("mouseleave", () => hidePointHighlight(highlight, tooltip));
}

/**
 * Find closest data point to mouse position
 */
function findClosestPoint(mouseX, mouseY, points) {
  let closestPoint = null;
  let minDistance = Infinity;

  points.forEach((point) => {
    const dx = point.x - mouseX;
    const dy = point.y - mouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = { ...point, distance };
    }
  });

  return closestPoint;
}

/**
 * Show highlight and tooltip for a point
 */
function showPointHighlight(
  highlight,
  point,
  colorScale,
  tooltip,
  event,
  timeDimension,
  groupDimension,
  measure,
  isNumericTime
) {
  // Update highlight position
  highlight.attr("cx", point.x).attr("cy", point.y).attr("fill", colorScale(point.group)).style("opacity", 0.8);

  // Format time value based on type
  const timeValue = isNumericTime ? point.data.parsedTime : d3.timeFormat("%Y-%m-%d")(point.data.parsedTime);

  // Show tooltip
  chartStyles.tooltip.show(
    tooltip,
    event,
    `
      <strong>${groupDimension}:</strong> ${point.group}<br>
      <strong>${timeDimension}:</strong> ${timeValue}<br>
      <strong>${measure}:</strong> ${formatValue(point.data[measure])}
    `
  );
}

/**
 * Hide highlight and tooltip
 */
function hidePointHighlight(highlight, tooltip) {
  highlight.style("opacity", 0);
  chartStyles.tooltip.hide(tooltip);
}

// ===== HELPER FUNCTIONS =====

/**
 * Sort groups by their final values (descending)
 */
function getSortedGroupsByFinalValue(data, groups, groupDimension, measure) {
  const groupedData = d3.group(data, (d) => d[groupDimension]);
  const finalValues = [];

  groups.forEach((group) => {
    const groupData = groupedData.get(group);

    if (groupData?.length) {
      // Get the last (most recent) point's value
      const sortedByTime = [...groupData].sort((a, b) => a.parsedTime - b.parsedTime);
      const lastPoint = sortedByTime[sortedByTime.length - 1];

      finalValues.push({
        group,
        finalValue: +lastPoint[measure] || 0,
      });
    } else {
      finalValues.push({ group, finalValue: 0 });
    }
  });

  // Sort by final value (descending) and return group names
  return finalValues.sort((a, b) => b.finalValue - a.finalValue).map((item) => item.group);
}

/**
 * Group and chronologically sort data
 */
function prepareGroupedData(data, groupDimension) {
  const grouped = d3.group(data, (d) => d[groupDimension]);

  return Array.from(grouped, ([key, values]) => ({
    key,
    values: [...values].sort((a, b) => a.parsedTime - b.parsedTime),
  }));
}

/**
 * Render X axis with appropriate formatting
 */
function renderXAxis(svg, xScale, height, isNumericTime, timeGrain) {
  // Determine tick format based on data type and grain
  const { tickFormat, rotateLabels, tickCount } = getXAxisTickSettings(xScale, isNumericTime, timeGrain);

  // Create axis generator
  const axisGenerator = d3.axisBottom(xScale).tickFormat(tickFormat);
  if (tickCount) axisGenerator.ticks(tickCount);

  // Add and style axis
  const axis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(axisGenerator);

  // Style the axis labels
  axis
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", rotateLabels ? "rotate(-45)" : "rotate(0)")
    .style("text-anchor", rotateLabels ? "end" : "middle");

  // Apply consistent styling
  chartStyles.applyAxisStyles(axis);
}

/**
 * Get tick settings for X axis based on data type
 */
function getXAxisTickSettings(xScale, isNumericTime, timeGrain) {
  let tickFormat,
    rotateLabels = false,
    tickCount;

  if (isNumericTime) {
    tickFormat = d3.format("d");
  } else {
    // Format based on time grain
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

    // Calculate appropriate tick count
    if (timeGrain === "year") {
      const timeSpan = xScale.domain()[1] - xScale.domain()[0];
      tickCount = Math.min(10, Math.ceil(timeSpan / (365 * 24 * 60 * 60 * 1000)));
    } else if (timeGrain === "month") {
      const timeSpan = xScale.domain()[1] - xScale.domain()[0];
      tickCount = Math.min(12, Math.ceil(timeSpan / (30 * 24 * 60 * 60 * 1000)));
    }
  }

  return { tickFormat, rotateLabels, tickCount };
}

/**
 * Render Y axis with appropriate formatting
 */
function renderYAxis(svg, yScale) {
  const axis = svg.append("g").attr("class", "y-axis").call(d3.axisLeft(yScale).tickFormat(formatValue));

  chartStyles.applyAxisStyles(axis);
}

export default renderLineChart;
