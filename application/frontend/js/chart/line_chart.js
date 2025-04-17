/**
 * Line Chart Component
 * Displays time series data with a single measure over time
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { formatValue, setupResizeHandler, validateRenderingContext } from "./utils/chartUtils.js";
import { createHorizontalLayout, createColorLegend } from "./utils/legendUtil.js";

/**
 * Main render function for line chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderLineChart(container) {
  if (!validateRenderingContext(container)) return;

  // Extract data and dimensions
  const dataset = state.dataset;
  const { timeDimension, measure, groupDimension } = extractDimensions();

  // Create layout and process data
  const { chartContainer, legendContainer } = setupChartLayout(container, groupDimension);
  const { processedData, uniqueGroups, isNumericTime, timeGrain } = processData(dataset, timeDimension, groupDimension);

  if (processedData.length === 0) {
    chartContainer.innerHTML = "<p>No valid time data available</p>";
    return;
  }

  // Create chart configuration
  const config = createChartConfig(chartContainer);
  const elements = createChartElements(chartContainer, config);
  const scales = createScales(processedData, measure, isNumericTime, config);
  const tooltip = chartStyles.createTooltip();

  // Create line generator
  const lineGenerator = createLineGenerator(scales.x, scales.y, measure);

  // Render chart components and get sorted groups for legend
  const sortedGroups = renderChart(
    elements,
    processedData,
    uniqueGroups,
    scales,
    lineGenerator,
    tooltip,
    config,
    timeDimension,
    measure,
    groupDimension,
    isNumericTime,
    timeGrain
  );

  // Create legend if needed - now using sorted groups
  if (groupDimension && sortedGroups.length > 0) {
    const colorScale = d3.scaleOrdinal().domain(sortedGroups).range(chartColors.mainPalette);
    createColorLegend(legendContainer, sortedGroups, colorScale);
  }

  // Setup resize handling
  setupResizeHandler(container, () => renderLineChart(container));
}

/**
 * Extract dimensions and measure from state
 */
function extractDimensions() {
  const timeDimension = state.aggregationDefinition.timeDimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Look for an additional grouping dimension (either categorical or geo)
  let groupDimension = null;
  if (state.aggregationDefinition.categoricalDimension?.length > 0) {
    groupDimension = state.aggregationDefinition.categoricalDimension[0];
  } else if (state.aggregationDefinition.geoDimension?.length > 0) {
    groupDimension = state.aggregationDefinition.geoDimension[0];
  }

  return { timeDimension, measure, groupDimension };
}

/**
 * Setup chart layout with chart and legend areas
 */
function setupChartLayout(container, groupDimension) {
  // If we have grouping, set up horizontal layout with legend
  if (groupDimension) {
    return createHorizontalLayout(container);
  }

  // No grouping - just return the container as the chart container
  container.innerHTML = "";
  return { chartContainer: container, legendContainer: null };
}

/**
 * Process and prepare data for visualization
 */
function processData(dataset, timeDimension, groupDimension) {
  const isNumericTime = /_datepart$/.test(timeDimension);
  let processedData = [];

  // Determine time grain from dimension name
  const timeGrain = determineTimeGrain(timeDimension);

  // Process time values appropriately
  if (isNumericTime) {
    // For numeric time dimensions, ensure values are numbers
    processedData = dataset
      .map((d) => ({
        ...d,
        parsedTime: +d[timeDimension],
      }))
      .filter((d) => !isNaN(d.parsedTime));
  } else {
    // For date-based time dimensions, parse as dates
    const parseTime = d3.timeParse("%Y-%m-%d");
    processedData = dataset
      .map((d) => ({
        ...d,
        parsedTime: parseTime(d[timeDimension]),
      }))
      .filter((d) => d.parsedTime);
  }

  // Extract unique groups if grouping is applied
  const uniqueGroups = groupDimension ? [...new Set(processedData.map((d) => d[groupDimension]))] : [];

  return { processedData, uniqueGroups, isNumericTime, timeGrain };
}

/**
 * Determine the time grain from the dimension name
 * @param {string} timeDimension - Name of the time dimension
 * @returns {string} - Time grain (day, week, month, year)
 */
function determineTimeGrain(timeDimension) {
  const dimensionLower = timeDimension.toLowerCase();

  if (dimensionLower.includes("year")) {
    return "year";
  } else if (dimensionLower.includes("month")) {
    return "month";
  } else if (dimensionLower.includes("week")) {
    return "week";
  } else {
    return "day";
  }
}

/**
 * Create chart configuration
 */
function createChartConfig(container) {
  const margin = { top: 20, right: 20, bottom: 70, left: 70 };
  const width = container.clientWidth - margin.left - margin.right;

  // Use container height instead of fixed CHART_DIMENSIONS.height
  const containerHeight = container.clientHeight || 500; // Fallback if clientHeight is 0
  const height = containerHeight - margin.top - margin.bottom;

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
    .attr("height", "100%") // Use 100% height to fill container
    .attr("preserveAspectRatio", "xMinYMin meet") // Preserve aspect ratio
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
    .domain([0, d3.max(data, (d) => +d[measure])])
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
    .y((d) => y(+d[measure]))
    .curve(d3.curveCardinal.tension(0.5));
}

/**
 * Render all chart components
 */
function renderChart(
  elements,
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
  timeGrain
) {
  // Add axes with consistent styling
  renderXAxis(elements.svg, scales.x, config.height, isNumericTime, timeGrain);
  renderYAxis(elements.svg, scales.y);

  // Draw lines based on grouping
  if (groupDimension && groups.length > 0) {
    // Sort groups by their values at the last time point
    const groupsWithFinalValues = getSortedGroupsByFinalValue(data, groups, groupDimension, measure);

    renderGroupedLines(
      elements.svg,
      data,
      groupsWithFinalValues, // Use sorted groups
      groupDimension,
      scales,
      lineGenerator,
      tooltip,
      config,
      timeDimension,
      measure,
      isNumericTime
    );

    // Store the sorted groups in the return value for legend creation
    return groupsWithFinalValues;
  } else {
    renderSingleLine(elements.svg, data, scales, lineGenerator, tooltip, config, timeDimension, measure);
    return groups;
  }
}

/**
 * Sort groups by their measure values at the last time point
 */
function getSortedGroupsByFinalValue(data, groups, groupDimension, measure) {
  // Group data by the dimension
  const groupedData = d3.group(data, (d) => d[groupDimension]);

  // For each group, find the data point with the latest time
  const finalValues = [];

  groups.forEach((group) => {
    const groupData = groupedData.get(group);
    if (groupData && groupData.length > 0) {
      // Sort by time, ascending
      const sortedByTime = [...groupData].sort((a, b) => a.parsedTime - b.parsedTime);
      // Get the last point (most recent)
      const lastPoint = sortedByTime[sortedByTime.length - 1];

      finalValues.push({
        group: group,
        finalValue: +lastPoint[measure],
      });
    } else {
      // If no data, push with 0 value
      finalValues.push({
        group: group,
        finalValue: 0,
      });
    }
  });

  // Sort by final value (descending)
  finalValues.sort((a, b) => b.finalValue - a.finalValue);

  // Return just the group names in the sorted order
  return finalValues.map((item) => item.group);
}

/**
 * Render X axis with appropriate formatting
 */
function renderXAxis(svg, xScale, height, isNumericTime, timeGrain) {
  let tickFormat;
  let rotateLabels = false;
  let tickCount;

  // Set format based on time grain
  if (isNumericTime) {
    tickFormat = d3.format("d");
  } else {
    // Choose format based on time grain
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
  }

  // Adjust tick count based on timeGrain and available width
  if (!isNumericTime) {
    const domain = xScale.domain();
    const timeSpan = domain[1] - domain[0]; // Time span in milliseconds

    if (timeGrain === "year") {
      // Approximately one tick per year
      tickCount = Math.min(10, Math.ceil(timeSpan / (365 * 24 * 60 * 60 * 1000)));
    } else if (timeGrain === "month") {
      // Approximately one tick every 1-3 months
      tickCount = Math.min(12, Math.ceil(timeSpan / (30 * 24 * 60 * 60 * 1000)));
    } else {
      // For week and day, let D3 decide based on the scale
      tickCount = null;
    }
  }

  // Create axis with appropriate tick formatting
  const axisGenerator = d3.axisBottom(xScale).tickFormat(tickFormat);

  // Apply tick count if specified
  if (tickCount) {
    axisGenerator.ticks(tickCount);
  }

  const axis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(axisGenerator);

  // Style the axis labels appropriately
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
 * Render Y axis with appropriate formatting
 */
function renderYAxis(svg, yScale) {
  const axis = svg.append("g").attr("class", "y-axis").call(d3.axisLeft(yScale).tickFormat(formatValue));

  chartStyles.applyAxisStyles(axis);
}

/**
 * Render grouped lines with interactive tooltips
 */
function renderGroupedLines(
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
  isNumericTime
) {
  // Create color scale
  const colorScale = d3.scaleOrdinal().domain(groups).range(chartColors.mainPalette);

  // Group data
  const groupedData = d3.group(data, (d) => d[groupDimension]);

  // Process groups for rendering
  const processedGroups = Array.from(groupedData, ([key, values]) => {
    // Sort values chronologically
    return {
      key,
      values: values.sort((a, b) => a.parsedTime - b.parsedTime),
    };
  });

  // Draw lines - one per group
  svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(processedGroups)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d) => colorScale(d.key))
    .attr("stroke-width", 2)
    .attr("d", (d) => lineGenerator(d.values));

  // Create interactive layer
  createInteractionLayer(
    svg,
    processedGroups,
    scales,
    colorScale,
    tooltip,
    lineGenerator,
    config,
    timeDimension,
    groupDimension,
    measure,
    isNumericTime
  );
}

/**
 * Render single line for non-grouped data
 */
function renderSingleLine(svg, data, scales, lineGenerator, tooltip, config, timeDimension, measure) {
  // Sort data chronologically
  const sortedData = data.sort((a, b) => a.parsedTime - b.parsedTime);

  // Draw the main line
  svg
    .append("path")
    .datum(sortedData)
    .attr("fill", "none")
    .attr("stroke", chartColors.mainPalette[0])
    .attr("stroke-width", 2)
    .attr("d", lineGenerator);

  // Create interactive layer for tooltips
  createSingleLineInteraction(svg, sortedData, scales, tooltip, lineGenerator, config, timeDimension, measure);
}

/**
 * Create interaction layer for grouped lines
 */
function createInteractionLayer(
  svg,
  groups,
  scales,
  colorScale,
  tooltip,
  lineGenerator,
  config,
  timeDimension,
  groupDimension,
  measure,
  isNumericTime
) {
  // Create flattened array of all points for Voronoi calculation
  const allPoints = [];
  groups.forEach((group) => {
    group.values.forEach((d) => {
      allPoints.push({
        x: scales.x(d.parsedTime),
        y: scales.y(+d[measure]),
        data: d,
        group: group.key,
      });
    });
  });

  // Create invisible overlay for mouse interaction
  const overlay = svg
    .append("rect")
    .attr("class", "overlay")
    .attr("width", config.width)
    .attr("height", config.height)
    .style("fill", "none")
    .style("pointer-events", "all");

  // Create highlight circle for active point
  const highlight = svg
    .append("circle")
    .attr("class", "highlight")
    .attr("r", 5)
    .style("fill", "none")
    .style("stroke", "#000")
    .style("stroke-width", 2)
    .style("opacity", 0);

  // Add mouse interaction
  overlay
    .on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event);

      // Find closest point to mouse position
      let closestPoint = null;
      let minDistance = Infinity;

      allPoints.forEach((point) => {
        const dx = point.x - mouseX;
        const dy = point.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      });

      // Only show tooltip if reasonably close to a point
      if (closestPoint && minDistance < 50) {
        // Update highlight position
        highlight
          .attr("cx", closestPoint.x)
          .attr("cy", closestPoint.y)
          .attr("fill", colorScale(closestPoint.group))
          .style("opacity", 0.8);

        // Format time value based on type
        const timeValue = isNumericTime
          ? closestPoint.data.parsedTime
          : d3.timeFormat("%Y-%m-%d")(closestPoint.data.parsedTime);

        // Show tooltip with formatted data
        chartStyles.showTooltip(
          tooltip,
          event,
          `
        <strong>${groupDimension}:</strong> ${closestPoint.group}<br>
        <strong>${timeDimension}:</strong> ${timeValue}<br>
        <strong>${measure}:</strong> ${formatValue(closestPoint.data[measure])}
      `
        );
      } else {
        // Hide tooltip when not near any point
        highlight.style("opacity", 0);
        chartStyles.hideTooltip(tooltip);
      }
    })
    .on("mouseleave", function () {
      // Hide tooltip when leaving chart area
      highlight.style("opacity", 0);
      chartStyles.hideTooltip(tooltip);
    });
}

/**
 * Create interaction layer for single line
 */
function createSingleLineInteraction(svg, data, scales, tooltip, lineGenerator, config, timeDimension, measure) {
  // Create array of points for interaction
  const points = data.map((d) => ({
    x: scales.x(d.parsedTime),
    y: scales.y(+d[measure]),
    data: d,
  }));

  // Create invisible overlay
  const overlay = svg
    .append("rect")
    .attr("class", "overlay")
    .attr("width", config.width)
    .attr("height", config.height)
    .style("fill", "none")
    .style("pointer-events", "all");

  // Create highlight circle
  const highlight = svg.append("circle").attr("r", 5).style("fill", chartColors.mainPalette[0]).style("opacity", 0);

  // Add mouse interactions
  overlay
    .on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event);

      // Find closest point
      let closestPoint = null;
      let minDistance = Infinity;

      points.forEach((point) => {
        const dx = point.x - mouseX;
        const dy = point.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      });

      // Only show tooltip if reasonably close to a point
      if (closestPoint && minDistance < 50) {
        // Update highlight position
        highlight.attr("cx", closestPoint.x).attr("cy", closestPoint.y).style("opacity", 0.8);

        // Format time value based on type
        const timeValue =
          typeof closestPoint.data.parsedTime === "number"
            ? closestPoint.data.parsedTime
            : d3.timeFormat("%Y-%m-%d")(closestPoint.data.parsedTime);

        // Show tooltip with formatted data
        chartStyles.showTooltip(
          tooltip,
          event,
          `
        <strong>${timeDimension}:</strong> ${timeValue}<br>
        <strong>${measure}:</strong> ${formatValue(closestPoint.data[measure])}
      `
        );
      } else {
        // Hide tooltip when not near any point
        highlight.style("opacity", 0);
        chartStyles.hideTooltip(tooltip);
      }
    })
    .on("mouseleave", function () {
      // Hide tooltip when leaving chart area
      highlight.style("opacity", 0);
      chartStyles.hideTooltip(tooltip);
    });
}

export default renderLineChart;
