import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js";

function renderNestedBarChart(container) {
  container.innerHTML = "";

  // Add controls container
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "chart-controls";
  container.appendChild(controlsDiv);

  // Set up dimensions and measures
  let dimensions = [...state.aggregationDefinition.dimensions];
  if (dimensions.length > 1) {
    addSwapButton(controlsDiv, container);
    if (container.swapDimensions) {
      [dimensions[0], dimensions[1]] = [dimensions[1], dimensions[0]];
    }
  }

  const measures = state.aggregationDefinition.measures.map((m) => m.alias);
  const hierarchicalData = createHierarchicalData(state.dataset, dimensions, measures);

  // Calculate layout dimensions
  const { sizing, scales } = calculateChartLayout(container, hierarchicalData, dimensions, measures);
  const { margin, width, height, dim1X, dim2X, barStartX, rowHeight, rowPadding, measureWidth, xScales } = sizing;

  // Create SVG and tooltip
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
  const tooltip = chartStyles.createTooltip();

  // Draw headers
  drawColumnHeaders(svg, dimensions, measures, dim1X, dim2X, barStartX, margin, measureWidth);

  // Draw the content
  drawNestedTable(
    svg,
    hierarchicalData,
    measures,
    xScales,
    { dim1X, dim2X, barStartX, measureWidth },
    margin,
    width,
    rowHeight,
    rowPadding,
    tooltip
  );
}

function addSwapButton(controlsDiv, container) {
  container.swapDimensions = container.swapDimensions || false;

  const swapBtn = document.createElement("button");
  swapBtn.textContent = "Swap Dimensions";
  swapBtn.className = "chart-button";
  swapBtn.style.marginBottom = "10px";

  swapBtn.addEventListener("click", () => {
    container.swapDimensions = !container.swapDimensions;
    renderNestedBarChart(container);
  });

  controlsDiv.appendChild(swapBtn);
}

function drawColumnHeaders(svg, dimensions, measures, dim1X, dim2X, barStartX, margin, measureWidth) {
  // Draw dimension headers
  svg
    .append("text")
    .attr("x", dim1X)
    .attr("y", margin.top - 20)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .attr("font-weight", "bold")
    .attr("font-family", chartStyles.fontFamily)
    .attr("text-anchor", "start")
    .text(dimensions[0]);

  svg
    .append("text")
    .attr("x", dim2X)
    .attr("y", margin.top - 20)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .attr("font-weight", "bold")
    .attr("font-family", chartStyles.fontFamily)
    .attr("text-anchor", "start")
    .text(dimensions[1] || "");

  // Draw measure headers
  measures.forEach((measure, i) => {
    const centerX = barStartX + i * measureWidth + measureWidth / 2;
    svg
      .append("text")
      .attr("x", centerX)
      .attr("y", margin.top - 20)
      .attr("font-size", chartStyles.fontSize.axisLabel)
      .attr("font-weight", "bold")
      .attr("font-family", chartStyles.fontFamily)
      .attr("text-anchor", "middle")
      .text(measure);
  });
}

function calculateChartLayout(container, data, dimensions, measures) {
  // Calculate dimension widths based on text
  const { dim1Width, dim2Width } = measureTextWidths(container, data);

  // Basic chart settings
  const margin = { top: 40, right: 120, bottom: 30, left: 30 };
  const width = CHART_DIMENSIONS.width || 800;
  const rowHeight = 24;
  const rowPadding = 4;

  // Calculate column positions
  const dim1X = margin.left;
  const dim2X = dim1X + dim1Width + 20;
  const barStartX = dim2X + dim2Width + 20;

  // Calculate space for measures
  const barAreaWidth = width - margin.right - barStartX;
  const measureWidth = barAreaWidth / measures.length;

  // Calculate chart height
  const totalRows = data.reduce((sum, category) => sum + category.segments.length, 0);
  const height = margin.top + margin.bottom + totalRows * (rowHeight + rowPadding);

  // Create scales for each measure
  const maxValues = {};
  measures.forEach((measure) => {
    maxValues[measure] = d3.max(
      data.flatMap((category) => category.segments.map((segment) => segment.measures[measure]))
    );
  });

  const xScales = {};
  measures.forEach((measure, i) => {
    const startX = barStartX + i * measureWidth;
    const endX = startX + measureWidth - 10;
    xScales[measure] = d3.scaleLinear().domain([0, maxValues[measure]]).range([startX, endX]).nice();
  });

  return {
    sizing: {
      margin,
      width,
      height,
      dim1X,
      dim2X,
      barStartX,
      rowHeight,
      rowPadding,
      measureWidth,
      xScales,
    },
    scales: xScales,
  };
}

function measureTextWidths(container, data) {
  // Create temporary measuring element
  const svg = d3.select(container).append("svg").attr("width", 0).attr("height", 0);
  const tempText = svg
    .append("text")
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .style("opacity", 0);

  // Get max lengths
  const getLongestText = (textArray) => {
    return textArray.reduce((a, b) => (a.toString().length > b.toString().length ? a : b), "");
  };

  // Measure dimensions
  tempText.text(getLongestText(data.map((d) => d.name)));
  const dim1ActualWidth = tempText.node().getComputedTextLength() || 0;

  tempText.text(getLongestText(data.flatMap((d) => d.segments.map((s) => s.name))));
  const dim2ActualWidth = tempText.node().getComputedTextLength() || 0;

  // Remove temp element
  svg.remove();

  return {
    dim1Width: Math.min(300, Math.max(120, dim1ActualWidth + 30)),
    dim2Width: Math.min(300, Math.max(150, dim2ActualWidth + 30)),
  };
}

function createHierarchicalData(dataset, dimensions, measures) {
  if (dimensions.length < 2) {
    return createSingleDimensionData(dataset, dimensions, measures);
  } else {
    return createMultiDimensionData(dataset, dimensions, measures);
  }
}

function createSingleDimensionData(dataset, dimensions, measures) {
  const segments = [];
  const grouped = d3.group(dataset, (d) => d[dimensions[0]]);

  for (const [name, values] of grouped) {
    const measureValues = {};
    measures.forEach((measure) => {
      measureValues[measure] = d3.sum(values, (d) => +d[measure]);
    });

    segments.push({
      name,
      measures: measureValues,
      value: measureValues[measures[0]],
    });
  }

  segments.sort((a, b) => b.measures[measures[0]] - a.measures[measures[0]]);
  return [{ name: "All", segments: segments }];
}

function createMultiDimensionData(dataset, dimensions, measures) {
  const dim1 = dimensions[0];
  const dim2 = dimensions[1];
  const hierarchicalData = [];

  // Group by primary dimension
  const categoryMap = d3.group(dataset, (d) => d[dim1]);

  for (const [categoryName, categoryItems] of categoryMap) {
    const segmentMap = d3.group(categoryItems, (d) => d[dim2]);
    const segments = [];

    for (const [segmentName, segmentItems] of segmentMap) {
      const measureValues = {};
      measures.forEach((measure) => {
        measureValues[measure] = d3.sum(segmentItems, (d) => +d[measure]);
      });

      segments.push({
        name: segmentName,
        measures: measureValues,
        value: measureValues[measures[0]],
      });
    }

    segments.sort((a, b) => b.measures[measures[0]] - a.measures[measures[0]]);
    hierarchicalData.push({ name: categoryName, segments });
  }

  // Sort categories by total value
  return hierarchicalData.sort((a, b) => {
    const aTotal = d3.sum(a.segments, (s) => s.measures[measures[0]]);
    const bTotal = d3.sum(b.segments, (s) => s.measures[measures[0]]);
    return bTotal - aTotal;
  });
}

function drawNestedTable(svg, data, measures, xScales, positions, margin, width, rowHeight, rowPadding, tooltip) {
  const { dim1X, dim2X, barStartX, measureWidth } = positions;
  const measureColors = ["#4e79a7", "#59a14f", "#f28e2c"];
  let y = margin.top;
  let globalSegmentIndex = 0;

  // STEP 1: Draw backgrounds first
  drawBackgrounds(svg, data, width, margin, rowHeight, rowPadding);

  // STEP 2: Draw border lines
  const dividerY = drawBorderLines(
    svg,
    data,
    width,
    margin,
    rowHeight,
    rowPadding,
    dim2X,
    barStartX,
    measures,
    measureWidth
  );

  // STEP 3: Draw text and bars
  drawDataRows(svg, data, measures, xScales, dim1X, dim2X, y, rowHeight, rowPadding, measureColors, tooltip);
}

function drawBackgrounds(svg, data, width, margin, rowHeight, rowPadding) {
  let bgY = margin.top;
  let index = 0;

  data.forEach((category) => {
    category.segments.forEach(() => {
      if (index % 2 === 0) {
        svg
          .append("rect")
          .attr("x", 0)
          .attr("y", bgY - rowPadding / 2)
          .attr("width", width)
          .attr("height", rowHeight + rowPadding)
          .attr("fill", "#f8f8f8")
          .attr("opacity", 0.5);
      }
      bgY += rowHeight + rowPadding;
      index++;
    });
  });
}

function drawBorderLines(svg, data, width, margin, rowHeight, rowPadding, dim2X, barStartX, measures, measureWidth) {
  // Draw top horizontal border line
  svg
    .append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", margin.top - rowPadding / 2)
    .attr("y2", margin.top - rowPadding / 2)
    .attr("stroke", "#ddd")
    .attr("stroke-width", 1)
    .attr("shape-rendering", "crispEdges");

  // Calculate divider line positions more precisely to match background rectangles
  let currentY = margin.top;
  data.forEach((category, categoryIndex) => {
    // Calculate exact ending position of this category
    // It's the starting position plus the height of all segments
    currentY += (rowHeight + rowPadding) * category.segments.length;

    // Draw a divider line at the exact bottom edge of the last background rectangle
    if (categoryIndex < data.length - 1) {
      svg
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", currentY - rowPadding / 2) // Adjusted position to match rectangle edge
        .attr("y2", currentY - rowPadding / 2) // Adjusted position to match rectangle edge
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");
    }
  });

  // Draw bottom horizontal border line (aligned with the bottom of the last background)
  svg
    .append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", currentY - rowPadding / 2) // Adjusted position to match last rectangle edge
    .attr("y2", currentY - rowPadding / 2) // Adjusted position to match last rectangle edge
    .attr("stroke", "#ddd")
    .attr("stroke-width", 1)
    .attr("shape-rendering", "crispEdges");

  // Add vertical separator lines (adjusted to match the new border positions)
  [dim2X - 10, barStartX - 10].forEach((x) => {
    svg
      .append("line")
      .attr("x1", x)
      .attr("x2", x)
      .attr("y1", margin.top - 30)
      .attr("y2", currentY - rowPadding / 2) // Match the bottom line
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1)
      .attr("shape-rendering", "crispEdges");
  });

  // Add measure separators (adjusted to match the new border positions)
  if (measures.length > 1) {
    for (let i = 1; i < measures.length; i++) {
      svg
        .append("line")
        .attr("x1", barStartX + i * measureWidth)
        .attr("x2", barStartX + i * measureWidth)
        .attr("y1", margin.top - 30)
        .attr("y2", currentY - rowPadding / 2) // Match the bottom line
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");
    }
  }

  return currentY - rowPadding / 2; // Return the adjusted divider Y position
}

function drawDataRows(svg, data, measures, xScales, dim1X, dim2X, y, rowHeight, rowPadding, measureColors, tooltip) {
  data.forEach((category) => {
    // Draw category name
    svg
      .append("text")
      .attr("x", dim1X)
      .attr("y", y + rowHeight / 2)
      .attr("font-family", chartStyles.fontFamily)
      .attr("font-size", chartStyles.fontSize.axisLabel)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "start")
      .attr("fill", "#333")
      .text(category.name);

    // Draw segments
    category.segments.forEach((segment) => {
      // Draw segment name
      svg
        .append("text")
        .attr("x", dim2X)
        .attr("y", y + rowHeight / 2)
        .attr("font-family", chartStyles.fontFamily)
        .attr("font-size", chartStyles.fontSize.axisLabel)
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "start")
        .attr("fill", "#333")
        .text(segment.name);

      // Draw bars for each measure
      measures.forEach((measure, i) => {
        drawMeasureBar(
          svg,
          measure,
          segment,
          category,
          xScales[measure],
          y,
          rowHeight,
          measureColors[i % measureColors.length],
          tooltip
        );
      });

      y += rowHeight + rowPadding;
    });
  });
}

function drawMeasureBar(svg, measure, segment, category, xScale, y, rowHeight, color, tooltip) {
  const value = segment.measures[measure];
  const startX = xScale.range()[0];
  const barWidth = xScale(value) - startX;

  // Draw bar
  svg
    .append("rect")
    .attr("x", startX)
    .attr("y", y + rowHeight * 0.15)
    .attr("width", Math.max(1, barWidth))
    .attr("height", rowHeight * 0.7)
    .attr("fill", color)
    .on("mouseover", function (event) {
      tooltip
        .style("opacity", 0.9)
        .html(`${category.name} > ${segment.name}<br>${measure}: ${d3.format(",")(value)}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Add value label
  const valueText = d3.format(",")(value);
  let labelX, labelAnchor, labelColor;

  if (barWidth > 40) {
    labelX = xScale(value) - 5;
    labelAnchor = "end";
    labelColor = "white";
  } else {
    labelX = xScale(value) + 5;
    labelAnchor = "start";
    labelColor = "black";
  }

  svg
    .append("text")
    .attr("x", labelX)
    .attr("y", y + rowHeight / 2)
    .attr("font-family", chartStyles.fontFamily)
    .attr("font-size", chartStyles.fontSize.axisLabel)
    .attr("dominant-baseline", "middle")
    .attr("text-anchor", labelAnchor)
    .attr("fill", labelColor)
    .text(valueText);
}

export default renderNestedBarChart;
