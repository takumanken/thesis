/**
 * Line Chart Component
 * Displays time series data with a single measure over time
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import * as chartUtils from "./utils/chartUtils.js";
import * as chartScales from "./utils/chartScales.js";
import * as chartAxes from "./utils/chartAxes.js";
import * as legendUtil from "./utils/legendUtil.js";

/**
 * Main render function for line chart
 */
function renderLineChart(container) {
  if (!chartUtils.validateRenderingContext(container)) return;

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
  const config = chartUtils.createChartConfig(chartContainer);
  const svg = createChartElements(chartContainer, config).svg;
  const scales = {
    x: chartScales.createTimeScale(processedData, isNumericTime, config.width, "parsedTime"),
    y: chartScales.createMeasureScale(processedData, measure, [config.height, 0]),
  };
  const tooltip = chartStyles.createTooltip();
  const lineGenerator = createLineGenerator(scales.x, scales.y, measure);

  // Draw chart components
  chartAxes.renderTimeAxis(svg, scales.x, config.height, isNumericTime, timeGrain);
  chartAxes.renderMeasureAxis(svg, scales.y, { orientation: "left", className: "y-axis" });

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
    legendUtil.createColorLegend(legendContainer, sortedGroups, colorScale, {}, groupDimension);
  }

  // Setup resize handler
  chartUtils.setupResizeHandler(container, () => renderLineChart(container));
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
  const timeGrain = chartUtils.determineTimeGrain(timeDimension);

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
  return dataset.map((d) => ({ ...d, parsedTime: +d[timeDimension] })).filter((d) => !isNaN(d.parsedTime));
}

/**
 * Process date-based time data
 */
function processDateTimeData(dataset, timeDimension) {
  const parseTime = d3.timeParse("%Y-%m-%d");
  return dataset.map((d) => ({ ...d, parsedTime: parseTime(d[timeDimension]) })).filter((d) => d.parsedTime);
}

// ===== CHART SETUP FUNCTIONS =====

/**
 * Setup chart layout with chart and legend areas
 */
function setupChartLayout(container, groupDimension) {
  if (groupDimension) {
    return legendUtil.createHorizontalLayout(container);
  }

  container.innerHTML = "";
  return { chartContainer: container, legendContainer: null };
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

  // Create visible points (smaller, just for visual reference)
  svg
    .selectAll("circle.point")
    .data(data)
    .join("circle")
    .attr("class", "point")
    .attr("cx", (d) => scales.x(d.parsedTime))
    .attr("cy", (d) => scales.y(+d[measure] || 0))
    .attr("r", 2)
    .attr("fill", chartColors.mainPalette[0])
    .attr("opacity", 0.7);

  // Create interactive overlay and highlight circle
  const overlay = chartUtils.createInteractionOverlay(svg, {
    width: scales.x.range()[1],
    height: scales.y.range()[0],
  });
  const highlight = chartUtils.createHighlightCircle(svg);

  // Create array of point coordinates for closest point detection
  const points = data.map((d) => ({
    x: scales.x(d.parsedTime),
    y: scales.y(+d[measure] || 0),
    data: d,
    group: "main", // Single group for single line
  }));

  // Setup mouse interaction
  overlay
    .on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event);
      const closestPoint = chartUtils.findClosestDataPoint(mouseX, mouseY, points);

      if (closestPoint && closestPoint.distance < 50) {
        // Show highlight and tooltip
        highlight
          .attr("cx", closestPoint.x)
          .attr("cy", closestPoint.y)
          .attr("fill", chartColors.mainPalette[0])
          .style("opacity", 0.8);

        const timeValue = chartUtils.formatTimeValue(closestPoint.data.parsedTime, isNumericTime);

        chartStyles.tooltip.show(
          tooltip,
          event,
          `
            <strong>${timeDimension}:</strong> ${timeValue}<br>
            <strong>${measure}:</strong> ${chartUtils.formatFullNumber(closestPoint.data[measure], measure)}
          `
        );
      } else {
        // Hide if no point is close
        highlight.style("opacity", 0);
        chartStyles.tooltip.hide(tooltip);
      }
    })
    .on("mouseleave", () => {
      highlight.style("opacity", 0);
      chartStyles.tooltip.hide(tooltip);
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
  const overlay = chartUtils.createInteractionOverlay(svg, config);
  const highlight = chartUtils.createHighlightCircle(svg);

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
      const closestPoint = chartUtils.findClosestDataPoint(mouseX, mouseY, points);

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
 * Show highlight and tooltip for a point
 */
function showPointHighlight(
  highlight,
  point,
  colorScale,
  tooltip,
  event,
  timeDimension,
  categoricalDimension,
  measure,
  isNumericTime
) {
  // Update highlight position
  highlight.attr("cx", point.x).attr("cy", point.y).attr("fill", colorScale(point.group)).style("opacity", 0.8);

  // Format time value based on type
  const timeValue = chartUtils.formatTimeValue(point.data.parsedTime, isNumericTime);

  // Show tooltip with translated field names
  chartStyles.tooltip.show(
    tooltip,
    event,
    `
      <strong>${chartUtils.getDisplayName(categoricalDimension)}:</strong> ${point.group}<br>
      <strong>${chartUtils.getDisplayName(timeDimension)}:</strong> ${timeValue}<br>
      <strong>${chartUtils.getDisplayName(measure)}:</strong> ${chartUtils.formatFullNumber(
      point.data[measure],
      measure
    )}
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

export default renderLineChart;
