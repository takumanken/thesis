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

  const rowHeight = chartStyles.barChart.bar.height;
  const rowPadding = chartStyles.barChart.bar.height * chartStyles.barChart.bar.padding;

  const hasTwoDimensions = dimensions.length > 1;
  const { dim1X, dim2X, barStartX } = calculateColumnPositions(margin.left, textMeasurements, hasTwoDimensions);
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
    hasTwoDimensions,
  };
}

function setupContainer(container, config) {
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${config.height}px`,
    overflow: config.height < config.fullHeight ? "auto" : "visible",
  });
}

function renderChart(container, data, dimensions, measures, config) {
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

// Chart structure functions

function drawStructure(svg, data, dimensions, measures, config) {
  drawBackgrounds(svg, data, config);
  drawGridLines(svg, data, dimensions, measures, config);
  drawColumnHeaders(svg, dimensions, measures, config);
}

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

function drawGridLines(svg, data, dimensions, measures, config) {
  const { width, margin, rowHeight, rowPadding } = config;
  const totalHeight = calculateTotalHeight(data, rowHeight, rowPadding);
  const bottomY = margin.top + totalHeight;

  // Horizontal borders
  chartAxes.createReferenceLine(svg, {
    orientation: "horizontal",
    position: margin.top - rowPadding / 2,
    start: 0,
    end: width,
    className: "top-border",
  });

  chartAxes.createReferenceLine(svg, {
    orientation: "horizontal",
    position: bottomY - rowPadding / 2,
    start: 0,
    end: width,
    className: "bottom-border",
  });

  if (config.hasTwoDimensions) {
    drawCategorySeparators(svg, data, config, width);
  }

  drawVerticalSeparators(svg, config, dimensions, measures, bottomY);
}

function drawColumnHeaders(svg, dimensions, measures, config) {
  const headerY = config.margin.top - 15;

  // Primary dimension
  drawHeader(svg, chartUtils.getDisplayName(dimensions[0]), config.dim1X, headerY);

  // Secondary dimension (if applicable)
  if (config.hasTwoDimensions && config.dim2X) {
    drawHeader(svg, chartUtils.getDisplayName(dimensions[1]), config.dim2X, headerY);
  }

  // Measures
  measures.forEach((measure, i) => {
    const centerX = config.barStartX + i * config.measureWidth + config.measureWidth / 2;
    drawHeader(svg, chartUtils.getDisplayName(measure), centerX, headerY, "middle");
  });
}

// Data visualization functions

function drawData(svg, data, dimensions, measures, config, tooltip) {
  const barsGroup = svg.append("g").attr("class", "bars-container");
  let y = config.margin.top;

  data.forEach((category) => {
    drawDimensionText(svg, category.name, config.dim1X, y, config);

    category.segments.forEach((segment) => {
      if (config.hasTwoDimensions && config.dim2X) {
        drawDimensionText(svg, segment.name, config.dim2X, y, config);
      }

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
              y: y + config.rowHeight * 0.15,
              width: Math.max(1, config.xScales[measure](val) - config.xScales[measure].range()[0]),
              height: config.rowHeight * 0.7,
              color: config.colors(measure),
            },
            tooltip
          );
        }
      });

      y += config.rowHeight + config.rowPadding;
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
    .attr("height", (d) => d.height)
    .attr("rx", chartStyles.barChart.bar.cornerRadius)
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
      const availableWidth = 25;
      if (textWidth > availableWidth) {
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

function drawCategorySeparators(svg, data, config, width) {
  let y = config.margin.top;

  data.forEach((category, i) => {
    if (i < data.length - 1) {
      y += (config.rowHeight + config.rowPadding) * category.segments.length;
      chartStyles.drawGridLine(svg, 0, width, y - config.rowPadding / 2, y - config.rowPadding / 2);
    }
  });
}

function drawVerticalSeparators(svg, config, dimensions, measures, bottomY) {
  const { margin, dim2X, barStartX, measureWidth } = config;
  const topY = margin.top - 30;

  // Dimension separator
  if (dim2X) {
    chartAxes.createReferenceLine(svg, {
      orientation: "vertical",
      position: dim2X - 10,
      start: topY,
      end: bottomY,
      className: "dimension-separator",
    });
  }

  // Bar area start separator
  chartAxes.createReferenceLine(svg, {
    orientation: "vertical",
    position: barStartX,
    start: topY,
    end: bottomY,
    className: "bar-area-separator",
  });

  // Measure separators
  if (measures.length > 1) {
    for (let i = 1; i < measures.length; i++) {
      const x = barStartX + i * measureWidth;
      chartAxes.createReferenceLine(svg, {
        orientation: "vertical",
        position: x,
        start: topY,
        end: bottomY,
        className: "measure-separator",
      });
    }
  }
}

function calculateMeasuresLayout(data, measures, barStartX, width, margin, rowHeight, rowPadding) {
  const barAreaWidth = width - margin.right - barStartX;
  const measureWidth = Math.max(80, barAreaWidth / measures.length);

  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  const contentHeight = totalRows * (rowHeight + rowPadding);
  const height = margin.top + margin.bottom + contentHeight;

  const maxValues = getMaxMeasureValues(data, measures);
  const xScales = createMeasureScales(measures, maxValues, barStartX, measureWidth);

  return { measureWidth, xScales, height };
}

function createMeasureScales(measures, maxValues, barStartX, measureWidth) {
  const xScales = {};
  const labelSpace = 45;
  const leftPadding = 0;

  measures.forEach((measure, i) => {
    const startX = barStartX + i * measureWidth + leftPadding;
    const endX = barStartX + (i + 1) * measureWidth - labelSpace;

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

function calculateTotalHeight(data, rowHeight, rowPadding) {
  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  return totalRows * (rowHeight + rowPadding);
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
    dim1Width: Math.min(300, Math.max(120, dim1Width + 30)),
    dim2Width: Math.min(300, Math.max(150, dim2Width + 30)),
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
