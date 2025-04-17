/**
 * Nested Bar Chart Component
 * Displays hierarchical data with measure bars grouped by one or two dimensions
 */
import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { chartControls } from "./utils/chartControls.js";
import {
  formatValue,
  setupResizeHandler,
  validateRenderingContext,
  setupDimensionSwapHandler,
  attachMouseTooltip,
} from "./utils/chartUtils.js";

/**
 * Main render function for nested bar chart
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderNestedBarChart(container) {
  if (!validateRenderingContext(container)) return;

  // Initialize dimension controls
  chartControls.initDimensionSwap("nested_bar_chart");
  const dimensions = chartControls.getSwappableDimensions();
  const measures = state.aggregationDefinition.measures.map((m) => m.alias);

  // Process data and render chart
  const data = createHierarchicalData(state.dataset, dimensions, measures);
  const config = createChartConfig(container, data, dimensions, measures);

  setupContainer(container, config);
  renderChartContent(container, data, dimensions, measures, config);
  setupEventHandlers(container);
}

/**
 * Creates chart configuration with layout calculations
 */
function createChartConfig(container, data, dimensions, measures) {
  // Text measurements and basic layout
  const textMeasurements = measureTextWidths(container, data);
  const margin = chartStyles.getChartMargins("nested_bar_chart");
  const width = container.clientWidth || CHART_DIMENSIONS.width;

  // Bar dimensions from chart styles
  const rowHeight = chartStyles.barChart.bar.height;
  const rowPadding = chartStyles.barChart.bar.height * chartStyles.barChart.bar.padding;

  // Calculate column positioning
  const { dim1X, dim2X, barStartX } = calculateColumnPositions(margin.left, textMeasurements, dimensions.length > 1);

  // Calculate measures layout
  const { measureWidth, xScales, height } = calculateMeasuresLayout(
    data,
    measures,
    barStartX,
    width,
    margin,
    rowHeight,
    rowPadding
  );

  return {
    margin,
    width,
    height: Math.min(height, chartStyles.barChart.maxHeight),
    fullHeight: height,
    dim1X,
    dim2X,
    barStartX,
    rowHeight,
    rowPadding,
    measureWidth,
    xScales,
    colors: getMeasureColors(measures),
    hasTwoDimensions: dimensions.length > 1,
  };
}

/**
 * Calculates column positions based on dimensions
 */
function calculateColumnPositions(leftMargin, textMeasurements, hasTwoDimensions) {
  const dim1X = leftMargin;

  if (hasTwoDimensions) {
    const dim2X = dim1X + textMeasurements.dim1Width + 20;
    const barStartX = dim2X + textMeasurements.dim2Width + 20;
    return { dim1X, dim2X, barStartX };
  } else {
    return {
      dim1X,
      dim2X: null,
      barStartX: dim1X + textMeasurements.dim1Width + 20,
    };
  }
}

/**
 * Gets color array for measures
 */
function getMeasureColors(measures) {
  return measures.map((_, i) => {
    if (i === 0) return chartColors.mainPalette[0];
    if (i === 1) return chartColors.mainPalette[5];
    return chartColors.mainPalette[i % chartColors.mainPalette.length];
  });
}

/**
 * Configures the container element
 */
function setupContainer(container, config) {
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${config.height}px`,
    overflow: config.height < config.fullHeight ? "auto" : "visible",
  });
}

/**
 * Renders the chart content
 */
function renderChartContent(container, data, dimensions, measures, config) {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", config.width)
    .attr("height", config.fullHeight)
    .attr("class", "viz-nested-bar-chart");

  const tooltip = chartStyles.createTooltip();

  drawStructure(svg, data, dimensions, measures, config);
  drawData(svg, data, dimensions, measures, config, tooltip);
}

/**
 * Draws chart structural elements
 */
function drawStructure(svg, data, dimensions, measures, config) {
  // Draw in proper order: backgrounds, grid, headers
  drawBackgrounds(svg, data, config);
  drawGridLines(svg, data, dimensions, measures, config);
  drawColumnHeaders(svg, dimensions, measures, config);
}

/**
 * Draws data elements
 */
function drawData(svg, data, dimensions, measures, config, tooltip) {
  let y = config.margin.top;

  data.forEach((category) => {
    // Label for primary dimension
    drawDimensionText(svg, category.name, config.dim1X, y, config);

    // Process each segment in this category
    category.segments.forEach((segment) => {
      // Label for secondary dimension (if applicable)
      if (config.hasTwoDimensions && config.dim2X) {
        drawDimensionText(svg, segment.name, config.dim2X, y, config);
      }

      // Draw bars for each measure
      measures.forEach((measure, i) => {
        const yCenter = y + config.rowHeight / 2;
        drawMeasureBar(
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
 * Draws dimension text with consistent styling
 */
function drawDimensionText(svg, text, x, y, config) {
  svg
    .append("text")
    .attr("x", x)
    .attr("y", y + config.rowHeight / 2)
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "start")
    .attr("fill", chartStyles.colors.text)
    .text(text || "");
}

/**
 * Draws column headers
 */
function drawColumnHeaders(svg, dimensions, measures, config) {
  const headerY = config.margin.top - 20;

  // Primary dimension header
  drawHeader(svg, dimensions[0], config.dim1X, headerY);

  // Secondary dimension header
  if (config.hasTwoDimensions && config.dim2X) {
    drawHeader(svg, dimensions[1], config.dim2X, headerY);
  }

  // Measure headers
  measures.forEach((measure, i) => {
    const centerX = config.barStartX + i * config.measureWidth + config.measureWidth / 2;
    drawHeader(svg, measure, centerX, headerY, "middle");
  });
}

/**
 * Draws a header text element
 */
function drawHeader(svg, text, x, y, anchor = "start") {
  svg
    .append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .attr("font-weight", "bold")
    .attr("text-anchor", anchor)
    .attr("fill", chartStyles.colors.text)
    .text(text);
}

/**
 * Draws alternating row backgrounds
 */
function drawBackgrounds(svg, data, config) {
  let y = config.margin.top;
  let rowIndex = 0;

  data.forEach((category) => {
    category.segments.forEach(() => {
      if (rowIndex % 2 === 0) {
        svg
          .append("rect")
          .attr("x", 0)
          .attr("y", y - config.rowPadding / 2)
          .attr("width", config.width)
          .attr("height", config.rowHeight + config.rowPadding)
          .attr("fill", chartStyles.colors.alternateBackground)
          .attr("opacity", 0.5);
      }
      y += config.rowHeight + config.rowPadding;
      rowIndex++;
    });
  });
}

/**
 * Draws grid lines for table structure
 */
function drawGridLines(svg, data, dimensions, measures, config) {
  const { width, margin, rowHeight, rowPadding } = config;
  const totalHeight = calculateTotalHeight(data, rowHeight, rowPadding);
  const bottomY = margin.top + totalHeight;

  // Horizontal lines
  chartStyles.drawGridLine(svg, 0, width, margin.top - rowPadding / 2, margin.top - rowPadding / 2); // Top
  chartStyles.drawGridLine(svg, 0, width, bottomY - rowPadding / 2, bottomY - rowPadding / 2); // Bottom

  // Category separator lines
  if (config.hasTwoDimensions) {
    drawCategorySeparators(svg, data, config, width);
  }

  // Vertical lines
  drawVerticalSeparators(svg, config, dimensions, measures, bottomY);
}

/**
 * Draws category separator lines
 */
function drawCategorySeparators(svg, data, config, width) {
  let y = config.margin.top;

  data.forEach((category, i) => {
    if (i < data.length - 1) {
      y += (config.rowHeight + config.rowPadding) * category.segments.length;
      chartStyles.drawGridLine(svg, 0, width, y - config.rowPadding / 2, y - config.rowPadding / 2);
    }
  });
}

/**
 * Draws vertical separator lines
 */
function drawVerticalSeparators(svg, config, dimensions, measures, bottomY) {
  const { margin, dim2X, barStartX, measureWidth } = config;
  const topY = margin.top - 30;

  // Dimension separator
  if (dim2X) {
    chartStyles.drawGridLine(svg, dim2X - 10, dim2X - 10, topY, bottomY);
  }

  // Bar area start separator
  chartStyles.drawGridLine(svg, barStartX - 10, barStartX - 10, topY, bottomY);

  // Measure separators
  if (measures.length > 1) {
    for (let i = 1; i < measures.length; i++) {
      const x = barStartX + i * measureWidth;
      chartStyles.drawGridLine(svg, x, x, topY, bottomY);
    }
  }
}

/**
 * Draws a single measure bar with value
 */
function drawMeasureBar(svg, measure, segment, category, xScale, y, rowHeight, color, tooltip) {
  const val = segment.measures[measure];
  const start = xScale.range()[0];
  const width = Math.max(1, xScale(val) - start);

  const bar = svg
    .append("rect")
    .attr("x", start)
    .attr("y", y + rowHeight * 0.15)
    .attr("width", width)
    .attr("height", rowHeight * 0.7)
    .attr("rx", chartStyles.barChart.bar.cornerRadius)
    .attr("fill", color);

  attachMouseTooltip(
    bar,
    tooltip,
    () => `
      <strong>${category.name}${segment.name ? " → " + segment.name : ""}</strong><br>
      <strong>${measure}:</strong> ${formatValue(val)}
    `
  );
}

/**
 * Calculate measures layout
 */
function calculateMeasuresLayout(data, measures, barStartX, width, margin, rowHeight, rowPadding) {
  // Calculate width available for each measure
  const barAreaWidth = width - margin.right - barStartX;
  const measureWidth = Math.max(80, barAreaWidth / measures.length);

  // Calculate total chart height
  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  const contentHeight = totalRows * (rowHeight + rowPadding);
  const height = margin.top + margin.bottom + contentHeight;

  // Create scales for each measure
  const maxValues = getMaxMeasureValues(data, measures);
  const xScales = createMeasureScales(measures, maxValues, barStartX, measureWidth);

  return { measureWidth, xScales, height };
}

/**
 * Creates scale for each measure
 */
function createMeasureScales(measures, maxValues, barStartX, measureWidth) {
  const xScales = {};

  measures.forEach((measure, i) => {
    const startX = barStartX + i * measureWidth;
    const endX = startX + measureWidth - 10;

    xScales[measure] = d3
      .scaleLinear()
      .domain([0, Math.max(1, maxValues[measure])])
      .range([startX, endX])
      .nice();
  });

  return xScales;
}

/**
 * Gets maximum values for each measure
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
 * Calculates the total height needed for all rows
 */
function calculateTotalHeight(data, rowHeight, rowPadding) {
  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  return totalRows * (rowHeight + rowPadding);
}

/**
 * Measure text dimensions for layout
 */
function measureTextWidths(container, data) {
  const svg = d3.select(container).append("svg").attr("width", 0).attr("height", 0);

  const tempText = svg
    .append("text")
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .style("opacity", 0);

  // Measure dimensions
  const dim1Text = getLongestText(data.map((d) => d.name));
  tempText.text(dim1Text);
  const dim1Width = tempText.node().getComputedTextLength() || 0;

  const dim2Text = getLongestText(data.flatMap((d) => d.segments.map((s) => s.name)));
  tempText.text(dim2Text);
  const dim2Width = tempText.node().getComputedTextLength() || 0;

  svg.remove();

  return {
    dim1Width: Math.min(300, Math.max(120, dim1Width + 30)),
    dim2Width: Math.min(300, Math.max(150, dim2Width + 30)),
  };
}

/**
 * Returns the longest text in an array based on character count
 */
function getLongestText(textArray) {
  return textArray.reduce((a, b) => (a?.toString().length > b?.toString().length ? a : b), "");
}

/**
 * Sets up event handlers
 */
function setupEventHandlers(container) {
  setupResizeHandler(container, () => renderNestedBarChart(container));
  setupDimensionSwapHandler(renderNestedBarChart);
}

/**
 * Creates hierarchical data structure from the dataset
 */
function createHierarchicalData(dataset, dimensions, measures) {
  return dimensions.length < 2
    ? createSingleDimensionData(dataset, dimensions, measures)
    : createMultiDimensionData(dataset, dimensions, measures);
}

/**
 * Creates hierarchical data for a single dimension
 */
function createSingleDimensionData(dataset, dimensions, measures) {
  const dimension = dimensions[0];
  const grouped = d3.group(dataset, (d) => d[dimension]);

  // Convert groups to hierarchical structure
  return Array.from(grouped)
    .map(([name, values]) => {
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
    })
    .sort((a, b) => b.segments[0].value - a.segments[0].value);
}

/**
 * Creates hierarchical data for two dimensions
 */
function createMultiDimensionData(dataset, dimensions, measures) {
  const [dim1, dim2] = dimensions;

  // Group by primary dimension
  const primaryGroups = d3.group(dataset, (d) => d[dim1]);
  const hierarchicalData = [];

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
