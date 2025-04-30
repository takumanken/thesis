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
    legendUtil.createColorLegend(legendContainer, sortedGroups, colorScale, {}, groupDimension); // Fixed - using sortedGroups
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

  // Create visible points
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

  // Add top and bottom value labels for single line (visible by default)
  createTopValueLabels(svg, data, scales, measure, chartColors.mainPalette[0], {
    isGrouped: false,
    visibleByDefault: true,
    topCount: 3,
    bottomCount: 2,
  });

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
          chartUtils.createStandardTooltip({
            dimensions: [{ name: timeDimension, value: timeValue }],
            measures: [{ name: measure, value: closestPoint.data[measure], field: measure }],
          })
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
  const lines = svg
    .append("g")
    .selectAll("path")
    .data(groupedData)
    .join("path")
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke", (d) => colorScale(d.key))
    .attr("stroke-width", 2)
    .attr("d", (d) => lineGenerator(d.values))
    .attr("data-group", (d) => d.key);

  // Add top and bottom value labels (hidden by default, shown on hover)
  createTopValueLabels(svg, groupedData, scales, measure, colorScale, {
    isGrouped: true,
    visibleByDefault: false,
    topCount: 3,
    bottomCount: 2,
  });

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

  // Show tooltip with standardized format
  chartStyles.tooltip.show(
    tooltip,
    event,
    chartUtils.createStandardTooltip({
      dimensions: [
        { name: categoricalDimension, value: point.group },
        { name: timeDimension, value: timeValue },
      ],
      measures: [{ name: measure, value: point.data[measure], field: measure }],
    })
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
 * Create value labels for line charts (highest and lowest)
 */
function createTopValueLabels(svg, data, scales, measure, color, options = {}) {
  // Default options
  const {
    isGrouped = false, // Whether data is grouped
    visibleByDefault = false, // Whether labels are visible by default
    topCount = 3, // Number of top points to show
    bottomCount = 2, // Number of bottom points to show
    labelOffset = 8, // Vertical offset for labels
  } = options;

  // Handle grouped or single data
  if (isGrouped) {
    // Process each group
    data.forEach((group) => {
      // Create high and low point labels for this group
      createExtremePointLabels(svg, group.values, scales, measure, color, group.key, {
        isGrouped,
        visibleByDefault,
        topCount,
        bottomCount,
        labelOffset,
      });
    });
  } else {
    // Process single dataset
    createExtremePointLabels(svg, data, scales, measure, color, null, {
      isGrouped,
      visibleByDefault,
      topCount,
      bottomCount,
      labelOffset,
    });
  }
}

/**
 * Create extreme (highest/lowest) point labels for a dataset
 */
function createExtremePointLabels(svg, values, scales, measure, color, groupKey, options) {
  const { isGrouped, visibleByDefault, topCount, bottomCount, labelOffset } = options;

  // Skip if no data
  if (!values || !values.length) return;

  // Get the point color
  const pointColor = typeof color === "function" ? color(groupKey) : color;

  // Create highest value labels
  const highestValues = [...values].sort((a, b) => (+b[measure] || 0) - (+a[measure] || 0));
  const topPoints = highestValues.slice(0, topCount);

  topPoints.forEach((point, i) => {
    addPointLabel(svg, point, scales, measure, pointColor, {
      isGrouped,
      visibleByDefault,
      labelOffset,
      groupKey,
      labelSuffix: isGrouped ? "" : `high-${i + 1}`,
      position: "high",
    });
  });

  // Create lowest value labels
  const lowestValues = [...values].sort((a, b) => (+a[measure] || 0) - (+b[measure] || 0));
  const bottomPoints = lowestValues.slice(0, bottomCount);

  bottomPoints.forEach((point, i) => {
    addPointLabel(svg, point, scales, measure, pointColor, {
      isGrouped,
      visibleByDefault,
      labelOffset,
      groupKey,
      labelSuffix: isGrouped ? "" : `low-${i + 1}`,
      position: "low",
    });
  });
}

/**
 * Add a single point label with marker
 */
function addPointLabel(svg, point, scales, measure, color, options) {
  const { isGrouped, visibleByDefault, labelOffset, groupKey, labelSuffix } = options;

  // Determine class names based on chart type
  const labelClass = isGrouped ? "label-line" : `top-value-label ${labelSuffix}`;
  const markerClass = isGrouped ? "label-line" : `top-value-marker ${labelSuffix}`;

  // Create text label
  const label = svg
    .append("text")
    .attr("class", labelClass)
    .attr("x", scales.x(point.parsedTime))
    .attr("y", scales.y(+point[measure]) - labelOffset)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .style("opacity", visibleByDefault ? 1 : 0)
    .text(chartUtils.formatValue(+point[measure]));

  // Add data-group attribute for grouped charts
  if (groupKey) label.attr("data-group", groupKey);

  // Create marker circle
  const marker = svg
    .append("circle")
    .attr("class", markerClass)
    .attr("cx", scales.x(point.parsedTime))
    .attr("cy", scales.y(+point[measure]))
    .attr("r", 3)
    .attr("fill", color)
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .style("opacity", visibleByDefault ? 1 : 0);

  // Add data-group attribute for grouped charts
  if (groupKey) marker.attr("data-group", groupKey);

  return { label, marker };
}

export default renderLineChart;
