/**
 * Stacked Area Chart Component
 * Displays time series data stacked by a categorical dimension
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { formatValue, setupResizeHandler, validateRenderingContext } from "./utils/chartUtils.js";
import { createHorizontalLayout, createColorLegend } from "./utils/legendUtil.js";

/**
 * Main render function for stacked area chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderStackedAreaChart(container) {
  if (!validateRenderingContext(container)) return;

  // Setup basic parameters
  const isPercentage = state.chartType === "stacked_area_chart_100";
  const dataset = state.dataset;
  const { timeDimension, categoricalDimension, measure } = extractDimensions();

  // Create layout
  const { chartContainer, legendContainer } = createHorizontalLayout(container);

  // Process data
  const { processedData, uniqueCategories, isNumericTime, timeGrain } = processData(
    dataset,
    timeDimension,
    categoricalDimension,
    measure
  );

  if (processedData.length === 0) {
    chartContainer.innerHTML = "<p>No valid time data available</p>";
    return;
  }

  // Configure chart
  const config = createChartConfig(chartContainer);
  const elements = createChartElements(chartContainer, config);
  const tooltip = chartStyles.createTooltip();

  // Create stacked data and scales
  const { stackedData, sortedCategories } = createStackedData(processedData, uniqueCategories, measure, isPercentage);
  const scales = createScales(processedData, stackedData, isNumericTime, isPercentage, config);

  // Render chart
  renderChart(
    elements.svg,
    stackedData,
    processedData,
    scales,
    sortedCategories,
    tooltip,
    config,
    timeDimension,
    categoricalDimension,
    measure,
    isNumericTime,
    isPercentage,
    timeGrain
  );

  // Create legend - reverse order to match visual stacking
  const colorScale = d3.scaleOrdinal().domain(sortedCategories).range(chartColors.mainPalette);
  createColorLegend(legendContainer, [...sortedCategories].reverse(), colorScale);

  // Setup resize handling
  setupResizeHandler(container, () => renderStackedAreaChart(container));
}

/**
 * Extract dimensions and measure from state
 */
function extractDimensions() {
  const timeDimension = state.aggregationDefinition.timeDimension[0];
  const categoricalDimension = state.aggregationDefinition.categoricalDimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  return { timeDimension, categoricalDimension, measure };
}

/**
 * Process and prepare data for visualization
 */
function processData(dataset, timeDimension, categoricalDimension, measure) {
  const isNumericTime = /_datepart$/.test(timeDimension);
  const timeGrain = determineTimeGrain(timeDimension);

  // Extract unique categories and time values
  const categories = new Set();
  const timeMap = new Map();

  // First pass - collect unique values
  dataset.forEach((d) => {
    if (d[categoricalDimension]) categories.add(d[categoricalDimension]);

    const timeValue = d[timeDimension];
    if (timeValue) {
      const parsedTime = isNumericTime ? +timeValue : d3.timeParse("%Y-%m-%d")(timeValue);

      if (parsedTime) timeMap.set(timeValue, parsedTime);
    }
  });

  // Return early if missing essential data
  const uniqueCategories = Array.from(categories);
  const timeValues = Array.from(timeMap.values()).sort((a, b) => a - b);

  if (!timeValues.length || !uniqueCategories.length) {
    return { processedData: [], uniqueCategories: [], isNumericTime, timeGrain };
  }

  // Initialize data structure with zeros
  const timeEntries = {};
  timeValues.forEach((time) => {
    const entry = { time };
    uniqueCategories.forEach((cat) => (entry[cat] = 0));

    // Use consistent key format for lookups
    const timeKey = isNumericTime ? time : d3.timeFormat("%Y-%m-%d")(time);
    timeEntries[timeKey] = entry;
  });

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
  const processedData = Object.values(timeEntries).sort((a, b) => a.time - b.time);

  return { processedData, uniqueCategories, isNumericTime, timeGrain };
}

/**
 * Determine the time grain from the dimension name
 * @param {string} timeDimension - Name of the time dimension
 * @returns {string} - Time grain (day, week, month, year)
 */
function determineTimeGrain(timeDimension) {
  const dimensionLower = timeDimension.toLowerCase();

  if (dimensionLower.includes("year")) return "year";
  if (dimensionLower.includes("month")) return "month";
  if (dimensionLower.includes("week")) return "week";
  return "day"; // Default
}

/**
 * Create chart configuration
 */
function createChartConfig(container) {
  const margin = { top: 20, right: 20, bottom: 70, left: 70 };
  const width = container.clientWidth - margin.left - margin.right;
  const containerHeight = container.clientHeight || 500;
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
    .attr("height", "100%")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .append("g")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);

  return { svg };
}

/**
 * Create scaled and stacked data structure
 */
function createStackedData(data, categories, measure, isPercentage) {
  // Calculate total value for each category for sorting
  const categoryTotals = {};
  categories.forEach((cat) => {
    categoryTotals[cat] = d3.sum(data, (d) => d[cat]);
  });

  // Sort categories by total value (descending)
  const sortedCategories = [...categories].sort((a, b) => categoryTotals[b] - categoryTotals[a]);

  // Store original values for percentage view
  if (isPercentage) {
    data.forEach((point) => {
      // Calculate total for this time point
      const total = sortedCategories.reduce((sum, cat) => sum + point[cat], 0);
      point._total = total;

      // Only store originals if we have values
      if (total > 0) {
        sortedCategories.forEach((cat) => {
          point[cat + "_original"] = point[cat];
        });
      }
    });
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
 * Create scales for axes
 */
function createScales(data, stackedData, isNumericTime, isPercentage, config) {
  // X-axis: Time scale
  const x = isNumericTime
    ? d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => d.time))
        .range([0, config.width])
        .nice()
    : d3
        .scaleTime()
        .domain(d3.extent(data, (d) => d.time))
        .range([0, config.width])
        .nice();

  // Y-axis: Value or percentage scale
  const y = isPercentage
    ? d3.scaleLinear().domain([0, 1]).range([config.height, 0])
    : d3
        .scaleLinear()
        .domain([0, d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) || 0])
        .range([config.height, 0])
        .nice();

  return { x, y };
}

/**
 * Render all chart components
 */
function renderChart(
  svg,
  stackedData,
  data,
  scales,
  categories,
  tooltip,
  config,
  timeDimension,
  categoricalDimension,
  measure,
  isNumericTime,
  isPercentage,
  timeGrain
) {
  // Create color scale
  const colorScale = d3.scaleOrdinal().domain(categories).range(chartColors.mainPalette);

  // Draw axes
  renderXAxis(svg, scales.x, config.height, isNumericTime, timeGrain);
  renderYAxis(svg, scales.y, isPercentage);

  // Create area generator
  const area = d3
    .area()
    .x((d) => scales.x(d.data.time))
    .y0((d) => scales.y(d[0]))
    .y1((d) => scales.y(d[1]))
    .curve(d3.curveCardinal.tension(0.7)); // Less pronounced curve

  // Draw areas
  svg
    .selectAll(".area")
    .data(stackedData)
    .join("path")
    .attr("class", "area")
    .attr("fill", (d) => colorScale(d.key))
    .attr("d", area)
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      showAreaTooltip(
        event,
        d,
        scales,
        data,
        colorScale,
        tooltip,
        isPercentage,
        isNumericTime,
        timeDimension,
        categoricalDimension,
        measure
      );
    })
    .on("mousemove", function (event, d) {
      showAreaTooltip(
        event,
        d,
        scales,
        data,
        colorScale,
        tooltip,
        isPercentage,
        isNumericTime,
        timeDimension,
        categoricalDimension,
        measure
      );
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.8);
      chartStyles.hideTooltip(tooltip);
    });
}

/**
 * Show tooltip for area sections
 */
function showAreaTooltip(
  event,
  d,
  scales,
  data,
  colorScale,
  tooltip,
  isPercentage,
  isNumericTime,
  timeDimension,
  categoricalDimension,
  measure
) {
  const [mouseX] = d3.pointer(event);
  const timePoint = findClosestDataPoint(mouseX, scales.x, data);

  if (!timePoint) return;

  const category = d.key;
  const value = isPercentage ? timePoint[category + "_original"] : timePoint[category];

  // Calculate total and percentage
  const total =
    timePoint._total ||
    d3.sum(
      Object.keys(timePoint)
        .filter((k) => k !== "time" && !k.includes("_"))
        .map((k) => timePoint[k])
    );

  const percentage = (value / total) * 100;

  // Format time string based on time type
  const timeStr = isNumericTime ? timePoint.time : d3.timeFormat("%Y-%m-%d")(timePoint.time);

  // Create tooltip content
  const tooltipContent = `
    <strong>${categoricalDimension}:</strong> ${category}<br>
    <strong>${timeDimension}:</strong> ${timeStr}<br>
    <strong>${measure}:</strong> ${formatValue(value)}<br>
    <strong>Percentage:</strong> ${percentage.toFixed(1)}%
  `;

  chartStyles.showTooltip(tooltip, event, tooltipContent);
}

/**
 * Find the closest data point to the mouse position
 */
function findClosestDataPoint(mouseX, xScale, data) {
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

/**
 * Render X axis with appropriate time formatting
 */
function renderXAxis(svg, xScale, height, isNumericTime, timeGrain) {
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
  }

  // Determine appropriate tick count
  if (!isNumericTime) {
    const domain = xScale.domain();
    const timeSpan = domain[1] - domain[0];

    if (timeGrain === "year") {
      tickCount = Math.min(10, Math.ceil(timeSpan / (365 * 24 * 60 * 60 * 1000)));
    } else if (timeGrain === "month") {
      tickCount = Math.min(12, Math.ceil(timeSpan / (30 * 24 * 60 * 60 * 1000)));
    } else {
      tickCount = null; // Let D3 decide for week/day
    }
  }

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
