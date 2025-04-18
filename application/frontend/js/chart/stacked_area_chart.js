/**
 * Stacked Area Chart Component
 * Displays time series data stacked by a categorical dimension
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { formatValue, setupResizeHandler, validateRenderingContext, attachMouseTooltip } from "./utils/chartUtils.js";
import { createHorizontalLayout, createColorLegend } from "./utils/legendUtil.js";

// ===== MAIN RENDERING FUNCTION =====

/**
 * Main render function for stacked area chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderStackedAreaChart(container) {
  if (!validateRenderingContext(container)) return;

  // Setup basic parameters
  const isPercentage = state.chartType === "stacked_area_chart_100";
  const { timeDimension, categoricalDimension, measure } = extractDimensions();
  const { chartContainer, legendContainer } = createHorizontalLayout(container);

  // Process data
  const { processedData, uniqueCategories, isNumericTime, timeGrain } = processData(
    state.dataset,
    timeDimension,
    categoricalDimension,
    measure
  );

  if (processedData.length === 0) {
    chartContainer.innerHTML = "<p>No valid time data available</p>";
    return;
  }

  // Set up chart and rendering
  const config = createChartConfig(chartContainer);
  const svg = createChartElements(chartContainer, config).svg;
  const tooltip = chartStyles.createTooltip();

  // Create stacked data and scales
  const { stackedData, sortedCategories } = createStackedData(processedData, uniqueCategories, isPercentage);
  const scales = createScales(processedData, stackedData, isNumericTime, isPercentage, config);

  // Render chart components
  renderChart({
    svg,
    stackedData,
    data: processedData,
    scales,
    categories: sortedCategories,
    tooltip,
    config,
    dimensions: { time: timeDimension, category: categoricalDimension },
    measure,
    options: { isNumericTime, isPercentage, timeGrain },
  });

  // Create legend - reverse order to match visual stacking
  const colorScale = d3.scaleOrdinal().domain(sortedCategories).range(chartColors.mainPalette);
  createColorLegend(legendContainer, [...sortedCategories].reverse(), colorScale);

  // Setup resize handling
  setupResizeHandler(container, () => renderStackedAreaChart(container));
}

// ===== DATA EXTRACTION & PROCESSING =====

/**
 * Extract dimensions and measure from state
 */
function extractDimensions() {
  return {
    timeDimension: state.aggregationDefinition.timeDimension[0],
    categoricalDimension: state.aggregationDefinition.categoricalDimension[0],
    measure: state.aggregationDefinition.measures[0].alias,
  };
}

/**
 * Process and prepare data for visualization
 */
function processData(dataset, timeDimension, categoricalDimension, measure) {
  if (!dataset || !dataset.length) {
    return { processedData: [], uniqueCategories: [], isNumericTime: false, timeGrain: "day" };
  }

  const isNumericTime = /_datepart$/.test(timeDimension);
  const timeGrain = determineTimeGrain(timeDimension);

  // Extract and collect unique categories and time values
  const { timeMap, categories } = collectUniques(dataset, timeDimension, categoricalDimension, isNumericTime);

  const uniqueCategories = Array.from(categories);
  const timeValues = Array.from(timeMap.values()).sort((a, b) => a - b);

  // Return early if missing essential data
  if (!timeValues.length || !uniqueCategories.length) {
    return { processedData: [], uniqueCategories: [], isNumericTime, timeGrain };
  }

  // Create and populate data structure
  const processedData = buildDataStructure(
    dataset,
    timeValues,
    uniqueCategories,
    timeMap,
    timeDimension,
    categoricalDimension,
    measure,
    isNumericTime
  );

  return { processedData, uniqueCategories, isNumericTime, timeGrain };
}

/**
 * Collect unique categories and time values from dataset
 */
function collectUniques(dataset, timeDimension, categoricalDimension, isNumericTime) {
  const categories = new Set();
  const timeMap = new Map();

  dataset.forEach((d) => {
    if (d[categoricalDimension]) categories.add(d[categoricalDimension]);

    const timeValue = d[timeDimension];
    if (timeValue) {
      const parsedTime = isNumericTime ? +timeValue : d3.timeParse("%Y-%m-%d")(timeValue);
      if (parsedTime) timeMap.set(timeValue, parsedTime);
    }
  });

  return { timeMap, categories };
}

/**
 * Build data structure with all time points and categories
 */
function buildDataStructure(
  dataset,
  timeValues,
  uniqueCategories,
  timeMap,
  timeDimension,
  categoricalDimension,
  measure,
  isNumericTime
) {
  // Initialize data structure with zeros
  const timeEntries = initializeTimeEntries(timeValues, uniqueCategories, isNumericTime);

  // Fill in actual values
  dataset.forEach((d) => {
    const timeKey = d[timeDimension];
    const category = d[categoricalDimension];
    const value = +d[measure] || 0;

    if (timeKey && category && timeEntries[timeKey]) {
      timeEntries[timeKey][category] += value;
    }
  });

  // Convert to array and sort chronologically
  return Object.values(timeEntries).sort((a, b) => a.time - b.time);
}

/**
 * Initialize time entries with zero values
 */
function initializeTimeEntries(timeValues, uniqueCategories, isNumericTime) {
  const timeEntries = {};

  timeValues.forEach((time) => {
    const entry = { time };
    uniqueCategories.forEach((cat) => (entry[cat] = 0));

    // Use consistent key format for lookups
    const timeKey = isNumericTime ? time : d3.timeFormat("%Y-%m-%d")(time);
    timeEntries[timeKey] = entry;
  });

  return timeEntries;
}

/**
 * Determine the time grain from the dimension name
 */
function determineTimeGrain(timeDimension) {
  const dimensionLower = timeDimension.toLowerCase();

  if (dimensionLower.includes("year")) return "year";
  if (dimensionLower.includes("month")) return "month";
  if (dimensionLower.includes("week")) return "week";
  return "day"; // Default
}

// ===== CHART SETUP =====

/**
 * Create chart configuration
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
 * Create scaled and stacked data structure
 */
function createStackedData(data, categories, isPercentage) {
  // Sort categories by total value (descending)
  const sortedCategories = sortCategoriesByTotal(data, categories);

  // Store original values for percentage view
  if (isPercentage) {
    preparePercentageData(data, sortedCategories);
  }

  // Create stacked data with d3.stack
  const stack = d3
    .stack()
    .keys(sortedCategories)
    .order(d3.stackOrderNone)
    .offset(isPercentage ? d3.stackOffsetExpand : d3.stackOffsetNone);

  return { stackedData: stack(data), sortedCategories };
}

/**
 * Sort categories by their total values
 */
function sortCategoriesByTotal(data, categories) {
  const categoryTotals = {};

  categories.forEach((cat) => {
    categoryTotals[cat] = d3.sum(data, (d) => d[cat]);
  });

  return [...categories].sort((a, b) => categoryTotals[b] - categoryTotals[a]);
}

/**
 * Prepare data for percentage view by storing original values
 */
function preparePercentageData(data, sortedCategories) {
  data.forEach((point) => {
    // Calculate total for this time point
    const total = sortedCategories.reduce((sum, cat) => sum + (point[cat] || 0), 0);
    point._total = total;

    // Only store originals if we have values
    if (total > 0) {
      sortedCategories.forEach((cat) => {
        point[cat + "_original"] = point[cat];
      });
    }
  });
}

/**
 * Create scales for axes
 */
function createScales(data, stackedData, isNumericTime, isPercentage, config) {
  // X-axis: Time scale
  const x = createTimeScale(data, isNumericTime, config.width);

  // Y-axis: Value or percentage scale
  const y = createValueScale(stackedData, isPercentage, config.height);

  return { x, y };
}

/**
 * Create appropriate time scale
 */
function createTimeScale(data, isNumericTime, width) {
  return isNumericTime
    ? d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => d.time))
        .range([0, width])
        .nice()
    : d3
        .scaleTime()
        .domain(d3.extent(data, (d) => d.time))
        .range([0, width])
        .nice();
}

/**
 * Create appropriate value scale
 */
function createValueScale(stackedData, isPercentage, height) {
  return isPercentage
    ? d3.scaleLinear().domain([0, 1]).range([height, 0])
    : d3
        .scaleLinear()
        .domain([0, d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) || 0])
        .range([height, 0])
        .nice();
}

// ===== CHART RENDERING =====

/**
 * Render all chart components
 */
function renderChart({ svg, stackedData, data, scales, categories, tooltip, config, dimensions, measure, options }) {
  const { isNumericTime, isPercentage, timeGrain } = options;

  // Create color scale
  const colorScale = d3.scaleOrdinal().domain(categories).range(chartColors.mainPalette);

  // Draw axes
  renderXAxis(svg, scales.x, config.height, isNumericTime, timeGrain);
  renderYAxis(svg, scales.y, isPercentage);

  // Draw areas
  const areas = renderAreaPaths(svg, stackedData, scales, colorScale);

  // Attach tooltips
  attachTooltips({
    areas,
    tooltip,
    data,
    scales,
    colorScale,
    dimensions,
    measure,
    options,
  });
}

/**
 * Render area paths
 */
function renderAreaPaths(svg, stackedData, scales, colorScale) {
  // Create area generator
  const area = d3
    .area()
    .x((d) => scales.x(d.data.time))
    .y0((d) => scales.y(d[0]))
    .y1((d) => scales.y(d[1]))
    .curve(d3.curveCardinal.tension(0.7));

  // Draw areas
  return svg
    .selectAll(".area")
    .data(stackedData)
    .join("path")
    .attr("class", "area")
    .attr("fill", (d) => colorScale(d.key))
    .attr("d", area)
    .attr("opacity", 0.8);
}

/**
 * Attach tooltips to area paths
 */
function attachTooltips({ areas, tooltip, data, scales, dimensions, measure, options }) {
  const { isNumericTime, isPercentage } = options;
  const { time: timeDimension, category: categoricalDimension } = dimensions;

  attachMouseTooltip(areas, tooltip, (layer, el, event) => {
    const [mouseX] = d3.pointer(event);
    const timePoint = findClosestDataPoint(mouseX, scales.x, data);
    if (!timePoint) return "";

    return createTooltipContent({
      timePoint,
      layer,
      timeDimension,
      categoricalDimension,
      measure,
      isNumericTime,
      isPercentage,
    });
  });
}

/**
 * Create tooltip content
 */
function createTooltipContent({
  timePoint,
  layer,
  timeDimension,
  categoricalDimension,
  measure,
  isNumericTime,
  isPercentage,
}) {
  const category = layer.key;
  const value = isPercentage ? timePoint[category + "_original"] : timePoint[category];

  // Skip if no value
  if (!value && value !== 0) return "";

  // Calculate percentage
  const total = calculateTotal(timePoint);
  const pct = (value / total) * 100;

  // Format time
  const timeStr = formatTimeValue(timePoint.time, isNumericTime);

  return `
    <strong>${categoricalDimension}:</strong> ${category}<br>
    <strong>${timeDimension}:</strong> ${timeStr}<br>
    <strong>${measure}:</strong> ${formatValue(value)}<br>
    <strong>Percentage:</strong> ${pct.toFixed(1)}%
  `;
}

/**
 * Format time value based on type
 */
function formatTimeValue(time, isNumericTime) {
  return isNumericTime ? time : d3.timeFormat("%Y-%m-%d")(time);
}

/**
 * Calculate total value for a time point
 */
function calculateTotal(timePoint) {
  if (timePoint._total) return timePoint._total;

  return Object.keys(timePoint)
    .filter((k) => k !== "time" && !k.includes("_"))
    .reduce((sum, key) => sum + (timePoint[key] || 0), 0);
}

/**
 * Find the closest data point to the mouse position
 */
function findClosestDataPoint(mouseX, xScale, data) {
  if (!data.length) return null;

  const date = xScale.invert(mouseX);
  const bisect = d3.bisector((d) => d.time).left;
  const index = bisect(data, date);

  // Handle edge cases
  if (index === 0) return data[0];
  if (index >= data.length) return data[data.length - 1];

  // Determine which point is closer
  const d0 = data[index - 1];
  const d1 = data[index];

  return date - d0.time > d1.time - date ? d1 : d0;
}

// ===== AXES RENDERING =====

/**
 * Render X axis with appropriate time formatting
 */
function renderXAxis(svg, xScale, height, isNumericTime, timeGrain) {
  const { tickFormat, rotateLabels, tickCount } = getXAxisSettings(xScale, isNumericTime, timeGrain);

  // Create and style axis
  const axisGenerator = d3.axisBottom(xScale).tickFormat(tickFormat);
  if (tickCount) axisGenerator.ticks(tickCount);

  const axis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(axisGenerator);

  // Style labels
  axis
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", rotateLabels ? "rotate(-45)" : "rotate(0)")
    .style("text-anchor", rotateLabels ? "end" : "middle");

  chartStyles.applyAxisStyles(axis);
}

/**
 * Get X axis tick settings
 */
function getXAxisSettings(xScale, isNumericTime, timeGrain) {
  let tickFormat;
  let rotateLabels = false;
  let tickCount;

  // Configure tick format based on time grain
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
    }
  }

  return { tickFormat, rotateLabels, tickCount };
}

/**
 * Render Y axis with appropriate value formatting
 */
function renderYAxis(svg, yScale, isPercentage) {
  const axisGenerator = isPercentage
    ? d3.axisLeft(yScale).tickFormat((d) => (d * 100).toFixed(0) + "%")
    : d3.axisLeft(yScale).tickFormat(formatValue);

  const axis = svg.append("g").attr("class", "y-axis").call(axisGenerator);

  chartStyles.applyAxisStyles(axis);
}

export default renderStackedAreaChart;
