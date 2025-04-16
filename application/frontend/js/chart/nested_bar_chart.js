/**
 * Nested Bar Chart Component
 * Displays hierarchical data with measure bars grouped by one or two dimensions
 */
import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { chartControls } from "./utils/chartControls.js";
import { formatValue, setupResizeHandler } from "./utils/chartUtils.js";

/**
 * Main render function for nested bar chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderNestedBarChart(container) {
  if (!isValidRenderingContext(container)) return;

  // Setup dimension controls and get data
  chartControls.initDimensionSwap("nested_bar_chart");
  const dimensions = chartControls.getSwappableDimensions();
  const measures = state.aggregationDefinition.measures.map((m) => m.alias);
  const data = createHierarchicalData(state.dataset, dimensions, measures);

  // Calculate layout and setup chart
  const config = createChartConfig(container, data, dimensions, measures);
  setupChartContainer(container, config);
  renderChart(container, data, dimensions, measures, config);
  setupEventHandlers(container);
}

/**
 * Creates complete chart configuration
 */
function createChartConfig(container, data, dimensions, measures) {
  // Text measurements
  const textMeasurements = measureTextWidths(container, data);

  // Basic dimensions
  const margin = { top: 40, right: 120, bottom: 30, left: 30 };
  const width = container.clientWidth || CHART_DIMENSIONS.width;
  const rowHeight = 24;
  const rowPadding = 4;

  // Calculate column positions
  const { dim1X, dim2X, barStartX } = calculateColumnPositions(margin, textMeasurements, dimensions);

  // Setup measures area
  const { measureWidth, xScales, height } = calculateMeasuresLayout(
    data,
    measures,
    barStartX,
    width,
    margin,
    rowHeight,
    rowPadding
  );

  // Assemble complete config
  return {
    margin,
    width,
    height: Math.max(100, height),
    dim1X,
    dim2X,
    barStartX,
    rowHeight,
    rowPadding,
    measureWidth,
    xScales,
    hasTwoDimensions: dimensions.length > 1,
    colors: getMeasureColors(measures),
  };
}

/**
 * Calculate column positions based on dimensions
 */
function calculateColumnPositions(margin, textMeasurements, dimensions) {
  const dim1X = margin.left;
  const { dim1Width, dim2Width } = textMeasurements;

  if (dimensions.length > 1) {
    // Two dimensions
    const dim2X = dim1X + dim1Width + 20;
    const barStartX = dim2X + dim2Width + 20;
    return { dim1X, dim2X, barStartX };
  } else {
    // One dimension
    const barStartX = dim1X + dim1Width + 20;
    return { dim1X, dim2X: null, barStartX };
  }
}

/**
 * Setup container for chart
 */
function setupChartContainer(container, config) {
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${config.height}px`,
  });
}

/**
 * Render the chart with all components
 */
function renderChart(container, data, dimensions, measures, config) {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", config.width)
    .attr("height", config.height)
    .attr("class", "viz-nested-bar-chart");

  const tooltip = chartStyles.createTooltip();

  // Draw all chart elements in proper order
  drawTableStructure(svg, data, dimensions, measures, config);
  drawDataContent(svg, data, dimensions, measures, config, tooltip);
}

/**
 * Draw the basic table structure (headers, backgrounds, grid)
 */
function drawTableStructure(svg, data, dimensions, measures, config) {
  drawColumnHeaders(svg, dimensions, measures, config);
  drawBackgrounds(svg, data, config);
  drawGridLines(svg, data, dimensions, measures, config);
}

/**
 * Draw all data content (labels, bars, values)
 */
function drawDataContent(svg, data, dimensions, measures, config, tooltip) {
  let y = config.margin.top;

  data.forEach((category) => {
    // Draw primary dimension label
    drawText(svg, category.name, config.dim1X, y + config.rowHeight / 2);

    // Process each segment in the category
    category.segments.forEach((segment) => {
      // Draw secondary dimension if applicable
      if (config.hasTwoDimensions && config.dim2X) {
        drawText(svg, segment.name, config.dim2X, y + config.rowHeight / 2);
      }

      // Draw measure bars
      measures.forEach((measure, i) => {
        drawBar(
          svg,
          measure,
          segment,
          category,
          config.xScales[measure],
          y,
          config.rowHeight,
          config.colors[i],
          tooltip
        );
      });

      y += config.rowHeight + config.rowPadding;
    });
  });
}

/**
 * Draw a text element
 */
function drawText(svg, text, x, y, anchor = "start") {
  svg
    .append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", anchor)
    .attr("fill", "#333")
    .text(text);
}

/**
 * Draw column headers
 */
function drawColumnHeaders(svg, dimensions, measures, config) {
  // Primary dimension header
  drawText(svg, dimensions[0], config.dim1X, config.margin.top - 20, "start");

  // Secondary dimension header (if applicable)
  if (config.hasTwoDimensions && config.dim2X) {
    drawText(svg, dimensions[1], config.dim2X, config.margin.top - 20, "start");
  }

  // Measure headers
  measures.forEach((measure, i) => {
    const centerX = config.barStartX + i * config.measureWidth + config.measureWidth / 2;
    drawText(svg, measure, centerX, config.margin.top - 20, "middle");
  });
}

/**
 * Draw alternating row backgrounds
 */
function drawBackgrounds(svg, data, config) {
  let y = config.margin.top;
  let index = 0;

  data.forEach((category) => {
    category.segments.forEach(() => {
      if (index % 2 === 0) {
        svg
          .append("rect")
          .attr("x", 0)
          .attr("y", y - config.rowPadding / 2)
          .attr("width", config.width)
          .attr("height", config.rowHeight + config.rowPadding)
          .attr("fill", "#f8f8f8")
          .attr("opacity", 1);
      }
      y += config.rowHeight + config.rowPadding;
      index++;
    });
  });
}

/**
 * Draw grid lines for table structure
 */
function drawGridLines(svg, data, dimensions, measures, config) {
  const { width, margin, rowHeight, rowPadding, hasTwoDimensions } = config;
  const totalHeight = getTotalRowHeight(data, rowHeight, rowPadding);
  const bottomY = margin.top + totalHeight;

  // Horizontal lines
  drawLine(svg, 0, width, margin.top - rowPadding / 2, margin.top - rowPadding / 2); // Top
  drawLine(svg, 0, width, bottomY - rowPadding / 2, bottomY - rowPadding / 2); // Bottom

  // Category separators (if two dimensions)
  if (hasTwoDimensions) {
    let y = margin.top;
    data.forEach((category, i) => {
      if (i < data.length - 1) {
        y += (rowHeight + rowPadding) * category.segments.length;
        drawLine(svg, 0, width, y - rowPadding / 2, y - rowPadding / 2);
      }
    });
  }

  // Vertical dimension separators
  if (config.dim2X) {
    drawLine(svg, config.dim2X - 10, config.dim2X - 10, margin.top - 30, bottomY);
  }

  drawLine(svg, config.barStartX - 10, config.barStartX - 10, margin.top - 30, bottomY);

  // Measure separators
  if (measures.length > 1) {
    for (let i = 1; i < measures.length; i++) {
      const x = config.barStartX + i * config.measureWidth;
      drawLine(svg, x, x, margin.top - 30, bottomY);
    }
  }
}

/**
 * Draw a single line
 */
function drawLine(svg, x1, x2, y1, y2) {
  svg
    .append("line")
    .attr("x1", x1)
    .attr("x2", x2)
    .attr("y1", y1)
    .attr("y2", y2)
    .attr("stroke", "#ddd")
    .attr("stroke-width", 1)
    .attr("shape-rendering", "crispEdges");
}

/**
 * Draw a single measure bar with value label
 */
function drawBar(svg, measure, segment, category, xScale, y, rowHeight, color, tooltip) {
  const value = segment.measures[measure];
  const startX = xScale.range()[0];
  const barWidth = Math.max(1, xScale(value) - startX);

  // Bar rectangle
  svg
    .append("rect")
    .attr("x", startX)
    .attr("y", y + rowHeight * 0.15)
    .attr("width", barWidth)
    .attr("height", rowHeight * 0.7)
    .attr("rx", chartStyles.barChart?.bar?.cornerRadius || 2)
    .attr("fill", color)
    .on("mouseover", (event) => {
      chartStyles.showTooltip(
        tooltip,
        event,
        `${category.name}${segment.name ? " > " + segment.name : ""}<br>${measure}: ${formatValue(value)}`
      );
    })
    .on("mouseout", () => chartStyles.hideTooltip(tooltip));

  // Value label (always to the right)
  svg
    .append("text")
    .attr("x", xScale(value) + 5)
    .attr("y", y + rowHeight / 2)
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "start")
    .attr("fill", "#333")
    .text(formatValue(value));
}

/**
 * Get configured colors for measures
 */
function getMeasureColors(measures) {
  return measures.map((_, i) => {
    if (i === 0) return chartColors.mainPalette[0]; // First measure color
    if (i === 1) return chartColors.mainPalette[5]; // Second measure color
    return chartColors.mainPalette[i % chartColors.mainPalette.length]; // Other colors
  });
}

/**
 * Calculate total height of all rows
 */
function getTotalRowHeight(data, rowHeight, rowPadding) {
  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  return totalRows * (rowHeight + rowPadding);
}

/**
 * Setup event handlers for chart
 */
function setupEventHandlers(container) {
  setupResizeHandler(container, () => renderNestedBarChart(container));

  document.removeEventListener("dimensionSwap", handleDimensionSwap);
  document.addEventListener("dimensionSwap", handleDimensionSwap);
}

/**
 * Handle dimension swap events
 */
function handleDimensionSwap() {
  const container = document.querySelector(".viz-container");
  if (container) renderNestedBarChart(container);
}

/**
 * Validate rendering context
 */
function isValidRenderingContext(container) {
  if (!container) {
    console.error("Container element is null or undefined");
    return false;
  }

  if (!state.dataset?.length) {
    container.innerHTML = "<p>No data available to display</p>";
    return false;
  }

  container.innerHTML = "";
  return true;
}

/**
 * Calculate layout for measures area
 */
function calculateMeasuresLayout(data, measures, barStartX, width, margin, rowHeight, rowPadding) {
  // Available width for measures
  const barAreaWidth = width - margin.right - barStartX;
  const measureWidth = Math.max(80, barAreaWidth / measures.length);

  // Calculate chart height
  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  const contentHeight = totalRows * (rowHeight + rowPadding);
  const height = margin.top + margin.bottom + contentHeight;

  // Create scales for measures
  const xScales = {};
  const maxValues = getMaxMeasureValues(data, measures);

  measures.forEach((measure, i) => {
    const startX = barStartX + i * measureWidth;
    const endX = startX + measureWidth - 10;

    xScales[measure] = d3
      .scaleLinear()
      .domain([0, Math.max(1, maxValues[measure])])
      .range([startX, endX])
      .nice();
  });

  return { measureWidth, xScales, height };
}

/**
 * Get maximum values for each measure
 */
function getMaxMeasureValues(data, measures) {
  const maxValues = {};

  measures.forEach((measure) => {
    maxValues[measure] =
      d3.max(data.flatMap((category) => category.segments.map((segment) => segment.measures[measure]))) || 0;
  });

  return maxValues;
}

/**
 * Measure text dimensions for layout
 */
function measureTextWidths(container, data) {
  // Create temporary element for measurement
  const svg = d3.select(container).append("svg").attr("width", 0).attr("height", 0);

  const tempText = svg
    .append("text")
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .style("opacity", 0);

  // Find longest primary dimension
  tempText.text(getLongestText(data.map((d) => d.name)));
  const dim1ActualWidth = tempText.node().getComputedTextLength() || 0;

  // Find longest secondary dimension
  tempText.text(getLongestText(data.flatMap((d) => d.segments.map((s) => s.name))));
  const dim2ActualWidth = tempText.node().getComputedTextLength() || 0;

  // Clean up
  svg.remove();

  return {
    dim1Width: Math.min(300, Math.max(120, dim1ActualWidth + 30)),
    dim2Width: Math.min(300, Math.max(150, dim2ActualWidth + 30)),
  };
}

/**
 * Find the longest text in an array
 */
function getLongestText(textArray) {
  return textArray.reduce((a, b) => (a.toString().length > b.toString().length ? a : b), "");
}

/**
 * Create hierarchical data structure
 */
function createHierarchicalData(dataset, dimensions, measures) {
  return dimensions.length < 2
    ? createSingleDimensionData(dataset, dimensions, measures)
    : createMultiDimensionData(dataset, dimensions, measures);
}

/**
 * Create data structure for single dimension
 */
function createSingleDimensionData(dataset, dimensions, measures) {
  const dimension = dimensions[0];
  const grouped = d3.group(dataset, (d) => d[dimension]);

  // Convert groups to hierarchical structure
  const hierarchicalData = Array.from(grouped).map(([name, values]) => {
    // Calculate measure values
    const measureValues = {};
    measures.forEach((measure) => {
      measureValues[measure] = d3.sum(values, (d) => +d[measure] || 0);
    });

    return {
      name,
      segments: [
        {
          name: "",
          measures: measureValues,
          value: measureValues[measures[0]],
        },
      ],
    };
  });

  return hierarchicalData.sort((a, b) => b.segments[0].measures[measures[0]] - a.segments[0].measures[measures[0]]);
}

/**
 * Create data structure for two dimensions
 */
function createMultiDimensionData(dataset, dimensions, measures) {
  const [dim1, dim2] = dimensions;
  const hierarchicalData = [];

  // Group by primary dimension
  const primaryGroups = d3.group(dataset, (d) => d[dim1]);

  for (const [categoryName, categoryItems] of primaryGroups) {
    // Group by secondary dimension
    const secondaryGroups = d3.group(categoryItems, (d) => d[dim2]);
    const segments = [];

    for (const [segmentName, segmentItems] of secondaryGroups) {
      // Calculate measure values
      const measureValues = {};
      measures.forEach((measure) => {
        measureValues[measure] = d3.sum(segmentItems, (d) => +d[measure] || 0);
      });

      segments.push({
        name: segmentName,
        measures: measureValues,
        value: measureValues[measures[0]],
      });
    }

    // Sort segments by primary measure
    segments.sort((a, b) => b.value - a.value);
    hierarchicalData.push({ name: categoryName, segments });
  }

  // Sort categories by total value
  return hierarchicalData.sort((a, b) => {
    const aTotal = d3.sum(a.segments, (s) => s.value);
    const bTotal = d3.sum(b.segments, (s) => s.value);
    return bTotal - aTotal;
  });
}

export default renderNestedBarChart;
