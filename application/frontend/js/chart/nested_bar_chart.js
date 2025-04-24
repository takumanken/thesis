/**
 * Nested Bar Chart Component
 * Displays hierarchical data with measure bars grouped by one or two dimensions
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { chartControls } from "./utils/chartControls.js";
import * as chartUtils from "./utils/chartUtils.js";
import * as chartScales from "./utils/chartScales.js";
import * as chartAxes from "./utils/chartAxes.js";

// -------------------------------------------------------------------------
// CHART DESIGN PARAMETERS
// -------------------------------------------------------------------------
const CHART_DESIGN = {
  barHeight: 15, // Height of each bar in pixels
  rowSpacing: 20, // Space between rows in pixels
  cornerRadius: 0, // Rounded corner radius
  maxChartHeight: 650, // Maximum overall chart height
  labelGap: 20, // Gap between dimensions and between dimension and bar
  maxDim1Width: 300, // Maximum width for dimension 1 labels
  maxDim2Width: 300, // Maximum width for dimension 2 labels
  minDim1Width: 120, // Minimum width for dimension 1 labels
  minDim2Width: 150, // Minimum width for dimension 2 labels
  minMeasureWidth: 80, // Minimum width for each measure column
  labelSpace: 45, // Space reserved for labels at end of bars
  headerGap: 10, // Distance from top margin to headers
};
// -------------------------------------------------------------------------

/**
 * Main render function for nested bar chart
 */
function renderNestedBarChart(container) {
  if (!chartUtils.validateRenderingContext(container)) return;

  chartControls.initDimensionSwap("nested_bar_chart");
  const dimensions = chartControls.getSwappableDimensions();
  const measures = state.aggregationDefinition.measures.map((m) => m.alias);

  const data = createHierarchicalData(state.dataset, dimensions, measures);
  const config = createChartConfig(container, data, dimensions, measures);

  setupContainer(container, config);
  renderChart(container, data, dimensions, measures, config);
  setupEventHandlers(container);
}

/**
 * Creates chart configuration with layout calculations
 */
function createChartConfig(container, data, dimensions, measures) {
  const textMeasurements = measureTextWidths(container, data);
  const margin = chartStyles.getChartMargins("nested_bar_chart");
  const width = container.clientWidth || 1440;

  // Make consistent with stacked bar chart
  const barHeight = CHART_DESIGN.barHeight;
  const rowSpacing = CHART_DESIGN.rowSpacing;
  const rowHeight = barHeight + rowSpacing;

  const hasTwoDimensions = dimensions.length > 1;
  const { dim1X, dim2X, barStartX } = calculateColumnPositions(margin.left, textMeasurements, hasTwoDimensions);
  const { measureWidth, xScales, height } = calculateMeasuresLayout(
    data,
    measures,
    barStartX,
    width,
    margin,
    rowHeight
  );

  return {
    margin,
    width,
    height: Math.min(height, CHART_DESIGN.maxChartHeight),
    fullHeight: height,
    dim1X,
    dim2X,
    barStartX,
    rowHeight,
    rowPadding: rowSpacing,
    barHeight,
    measureWidth,
    xScales,
    colors: getMeasureColors(measures),
    hasTwoDimensions,
  };
}

/**
 * Creates chart layout with fixed headers and scrollable content
 */
function setupContainer(container, config) {
  // Clear container
  container.innerHTML = "";

  // Create header container and scrollable content container
  const headerContainer = document.createElement("div");
  headerContainer.className = "viz-header-container";

  const scrollContainer = document.createElement("div");
  scrollContainer.className = "viz-content-scroll";

  // Set up styles
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${config.height}px`,
  });

  Object.assign(headerContainer.style, {
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    height: `${config.margin.top}px`,
    zIndex: "1",
  });

  Object.assign(scrollContainer.style, {
    position: "absolute",
    top: `${config.margin.top}px`,
    bottom: "0",
    left: "0",
    right: "0",
    overflowY: config.height < config.fullHeight ? "auto" : "hidden",
    overflowX: "hidden",
  });

  // Add to DOM
  container.appendChild(headerContainer);
  container.appendChild(scrollContainer);

  return { headerContainer, scrollContainer };
}

/**
 * Renders the chart with fixed headers and scrollable content
 */
function renderChart(container, data, dimensions, measures, config) {
  const { headerContainer, scrollContainer } = setupContainer(container, config);

  // Create header SVG
  const headerSvg = d3
    .select(headerContainer)
    .append("svg")
    .attr("width", config.width)
    .attr("height", config.margin.top)
    .attr("class", "viz-nested-bar-headers");

  // Create content SVG
  const contentSvg = d3
    .select(scrollContainer)
    .append("svg")
    .attr("width", config.width)
    .attr("height", config.fullHeight - config.margin.top)
    .attr("class", "viz-nested-bar-content");

  const tooltip = chartStyles.createTooltip();

  // Draw header elements in the fixed header SVG
  drawColumnHeaders(headerSvg, dimensions, measures, config);

  // Draw content elements in the scrollable content SVG
  drawBackgrounds(contentSvg, data, config);
  drawGridLines(contentSvg, data, dimensions, measures, config);
  drawData(contentSvg, data, dimensions, measures, config, tooltip);
}

/**
 * Draws column headers in the fixed header SVG
 */
function drawColumnHeaders(svg, dimensions, measures, config) {
  const headerY = config.margin.top - 10;

  // Draw primary dimension header
  drawHeader(svg, chartUtils.getDisplayName(dimensions[0]), config.dim1X, headerY);

  // Draw secondary dimension header if applicable
  if (config.hasTwoDimensions && config.dim2X) {
    drawHeader(svg, chartUtils.getDisplayName(dimensions[1]), config.dim2X, headerY);
  }

  // Draw measure headers
  measures.forEach((measure, i) => {
    const centerX = config.barStartX + i * config.measureWidth + config.measureWidth / 2;
    drawHeader(svg, chartUtils.getDisplayName(measure), centerX, headerY, "middle");
  });

  // Draw vertical separators in header
  const endY = config.margin.top;
  const startY = 10;

  // Draw vertical grid lines that separate dimensions from measures
  if (config.dim2X) {
    chartAxes.createReferenceLine(svg, {
      orientation: "vertical",
      position: config.dim2X - 10,
      start: startY,
      end: endY,
      className: "dimension-separator",
    });
  }

  chartAxes.createReferenceLine(svg, {
    orientation: "vertical",
    position: config.barStartX,
    start: startY,
    end: endY,
    className: "bar-area-separator",
  });

  // Draw measure separators
  if (measures.length > 1) {
    for (let i = 1; i < measures.length; i++) {
      const x = config.barStartX + i * config.measureWidth;
      chartAxes.createReferenceLine(svg, {
        orientation: "vertical",
        position: x,
        start: startY,
        end: endY,
        className: "measure-separator",
      });
    }
  }

  // Draw bottom border for header
  chartAxes.createReferenceLine(svg, {
    orientation: "horizontal",
    position: endY,
    start: 0,
    end: config.width,
    className: "header-border",
  });
}

// Chart structure functions

function drawBackgrounds(svg, data, config) {
  let y = config.margin.top - 30;
  let rowIndex = 0;

  data.forEach((category) => {
    category.segments.forEach(() => {
      const rowCenter = y + config.barHeight / 2;
      const barTop = rowCenter - config.barHeight / 2;

      if (rowIndex % 2 === 0) {
        svg
          .append("rect")
          .attr("x", 0)
          .attr("y", barTop - config.rowPadding / 2)
          .attr("width", config.width)
          .attr("height", config.barHeight + config.rowPadding)
          .attr("fill", chartStyles.colors.alternateBackground)
          .attr("opacity", 1);
      }
      y += config.rowHeight;
      rowIndex++;
    });
  });
}

function drawGridLines(svg, data, dimensions, measures, config) {
  const { width, margin, rowHeight } = config;
  const totalHeight = calculateTotalHeight(data, rowHeight);
  const bottomY = margin.top + totalHeight;

  chartAxes.createReferenceLine(svg, {
    orientation: "horizontal",
    position: bottomY - config.rowPadding / 2 - 30,
    start: 0,
    end: width,
    className: "bottom-border",
  });

  if (config.hasTwoDimensions) {
    drawCategorySeparators(svg, data, config, width);
  }

  drawVerticalSeparators(svg, config, dimensions, measures, bottomY);
}

function drawCategorySeparators(svg, data, config, width) {
  let y = config.margin.top;

  data.forEach((category, i) => {
    const categoryHeight = category.segments.length * config.rowHeight;
    y += categoryHeight;

    if (i < data.length - 1) {
      chartStyles.drawGridLine(svg, 0, width, y - CHART_DESIGN.rowSpacing / 2, y - CHART_DESIGN.rowSpacing / 2);
    }
  });
}

// Data visualization functions

function drawData(svg, data, dimensions, measures, config, tooltip) {
  const barsGroup = svg.append("g").attr("class", "bars-container");
  let y = config.margin.top - 30;

  data.forEach((category) => {
    drawDimensionText(svg, category.name, config.dim1X, y, config);

    category.segments.forEach((segment) => {
      if (config.hasTwoDimensions && config.dim2X) {
        drawDimensionText(svg, segment.name, config.dim2X, y, config);
      }

      const rowCenter = y + config.barHeight / 2;

      measures.forEach((measure, i) => {
        const val = segment.measures[measure];
        if (val) {
          drawBar(
            barsGroup,
            {
              value: val,
              category: category.name,
              segment: segment.name,
              measure: measure,
              x: config.xScales[measure].range()[0],
              y: rowCenter - CHART_DESIGN.barHeight / 2,
              width: Math.max(1, config.xScales[measure](val) - config.xScales[measure].range()[0]),
              height: CHART_DESIGN.barHeight,
              color: config.colors(measure),
            },
            tooltip
          );
        }
      });

      y += config.rowHeight;
    });
  });
}

function drawBar(svg, bar, tooltip) {
  const barGroup = svg.append("g").datum(bar);

  const rect = barGroup
    .append("rect")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("width", (d) => d.width)
    .attr("height", CHART_DESIGN.barHeight)
    .attr("rx", CHART_DESIGN.cornerRadius)
    .attr("fill", (d) => d.color);

  barGroup
    .append("text")
    .attr("x", (d) => d.x + d.width + 5)
    .attr("y", (d) => d.y + d.height / 2)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "middle")
    .attr("fill", chartStyles.colors.text)
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", "11px")
    .attr("pointer-events", "none")
    .text((d) => chartUtils.formatValue(d.value))
    .each(function (d) {
      const textWidth = this.getComputedTextLength();
      if (textWidth > 25) {
        d3.select(this).text(chartUtils.formatValue(d.value, true));
      }
    });

  chartUtils.attachMouseTooltip(
    rect,
    tooltip,
    (d) => `<strong>${d.category}${d.segment ? " → " + d.segment : ""}</strong><br>
      <strong>${chartUtils.getDisplayName(d.measure)}:</strong> ${chartUtils.formatValue(d.value)}`
  );
}

function drawDimensionText(svg, text, x, y, config) {
  const fontSize = chartStyles.fontSize.axisLabel;
  const fontSizeInteger = parseInt(fontSize.replace("px", ""));

  svg
    .append("text")
    .attr("x", x)
    .attr("y", y + fontSizeInteger * 0.75)
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", fontSize)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", "start")
    .attr("fill", chartStyles.colors.text)
    .text(text || "");
}

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

// Layout helper functions

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

function getMeasureColors(measures) {
  const colorRange = measures.map((_, i) => {
    if (i === 0) return chartColors.mainPalette[0];
    if (i === 1) return chartColors.mainPalette[5];
    return chartColors.mainPalette[i % chartColors.mainPalette.length];
  });

  return chartScales.createColorScale(measures, colorRange);
}

function drawVerticalSeparators(svg, config, dimensions, measures, bottomY) {
  const { margin, dim2X, barStartX, measureWidth } = config;
  const topY = margin.top - 40;
  const endY = bottomY - CHART_DESIGN.rowSpacing / 2 - 30;

  if (dim2X) {
    chartAxes.createReferenceLine(svg, {
      orientation: "vertical",
      position: dim2X - 10,
      start: topY,
      end: endY,
      className: "dimension-separator",
    });
  }

  chartAxes.createReferenceLine(svg, {
    orientation: "vertical",
    position: barStartX,
    start: topY,
    end: endY,
    className: "bar-area-separator",
  });

  if (measures.length > 1) {
    for (let i = 1; i < measures.length; i++) {
      const x = barStartX + i * measureWidth;
      chartAxes.createReferenceLine(svg, {
        orientation: "vertical",
        position: x,
        start: topY,
        end: endY,
        className: "measure-separator",
      });
    }
  }
}

function calculateMeasuresLayout(data, measures, barStartX, width, margin, rowHeight) {
  const barAreaWidth = width - margin.right - barStartX;
  const measureWidth = Math.max(CHART_DESIGN.minMeasureWidth, barAreaWidth / measures.length);

  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  const contentHeight = totalRows * rowHeight;
  const height = margin.top + margin.bottom + contentHeight;

  const maxValues = getMaxMeasureValues(data, measures);
  const xScales = createMeasureScales(measures, maxValues, barStartX, measureWidth);

  return { measureWidth, xScales, height };
}

function createMeasureScales(measures, maxValues, barStartX, measureWidth) {
  const xScales = {};

  measures.forEach((measure, i) => {
    const startX = barStartX + i * measureWidth;
    const endX = barStartX + (i + 1) * measureWidth - CHART_DESIGN.labelSpace;

    xScales[measure] = d3.scaleLinear().domain([0, maxValues[measure]]).range([startX, endX]);
  });

  return xScales;
}

function getMaxMeasureValues(data, measures) {
  const maxValues = {};

  measures.forEach((measure) => {
    maxValues[measure] =
      d3.max(data.flatMap((category) => category.segments.map((segment) => segment.measures[measure]))) || 0;
  });

  return maxValues;
}

function calculateTotalHeight(data, rowHeight) {
  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  return totalRows * rowHeight;
}

function measureTextWidths(container, data) {
  const svg = d3.select(container).append("svg").attr("width", 0).attr("height", 0);
  const tempText = svg
    .append("text")
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .style("opacity", 0);

  const dim1Text = getLongestText(data.map((d) => d.name));
  tempText.text(dim1Text);
  const dim1Width = tempText.node().getComputedTextLength() || 0;

  const dim2Text = getLongestText(data.flatMap((d) => d.segments.map((s) => s.name)));
  tempText.text(dim2Text);
  const dim2Width = tempText.node().getComputedTextLength() || 0;

  svg.remove();

  return {
    dim1Width: Math.min(CHART_DESIGN.maxDim1Width, Math.max(CHART_DESIGN.minDim1Width, dim1Width + 30)),
    dim2Width: Math.min(CHART_DESIGN.maxDim2Width, Math.max(CHART_DESIGN.minDim2Width, dim2Width + 30)),
  };
}

function getLongestText(textArray) {
  return textArray.reduce((a, b) => (a?.toString().length > b?.toString().length ? a : b), "");
}

function setupEventHandlers(container) {
  chartUtils.setupResizeHandler(container, () => renderNestedBarChart(container));
  chartUtils.setupDimensionSwapHandler(renderNestedBarChart);
}

// Data processing functions

function createHierarchicalData(dataset, dimensions, measures) {
  return dimensions.length < 2
    ? createSingleDimensionData(dataset, dimensions, measures)
    : createMultiDimensionData(dataset, dimensions, measures);
}

function createSingleDimensionData(dataset, dimensions, measures) {
  const dimension = dimensions[0];
  const grouped = d3.group(dataset, (d) => d[dimension]);

  return Array.from(grouped)
    .map(([name, values]) => {
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

function createMultiDimensionData(dataset, dimensions, measures) {
  const [dim1, dim2] = dimensions;
  const primaryGroups = d3.group(dataset, (d) => d[dim1]);
  const hierarchicalData = [];

  for (const [categoryName, categoryItems] of primaryGroups) {
    const secondaryGroups = d3.group(categoryItems, (d) => d[dim2]);
    const segments = [];

    for (const [segmentName, segmentItems] of secondaryGroups) {
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

    segments.sort((a, b) => b.value - a.value);
    hierarchicalData.push({ name: categoryName, segments });
  }

  return hierarchicalData.sort((a, b) => {
    const aTotal = d3.sum(a.segments, (s) => s.value);
    const bTotal = d3.sum(b.segments, (s) => s.value);
    return bTotal - aTotal;
  });
}

export default renderNestedBarChart;
