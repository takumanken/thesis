import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { truncateLabel, formatValue, setupResizeHandler } from "./utils/chartUtils.js";
import { chartControls } from "./utils/chartControls.js";

/**
 * Renders a treemap visualization
 */
function renderTreemap(container) {
  // Validate input and set up container
  if (!container || !state.dataset?.length) {
    if (container) container.innerHTML = "<p>No data available to display</p>";
    return;
  }

  // Clear and configure container
  container.innerHTML = "";
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: "500px",
  });

  // Set up dimension control and get data
  chartControls.initDimensionSwap("treemap");
  const dimensions = chartControls.getSwappableDimensions();
  const measure = state.aggregationDefinition.measures[0].alias;

  // Create and render visualization
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("class", "viz-treemap-canvas");

  const data = processData(dimensions, measure);
  renderCells(container, svg, data, dimensions, measure);

  // Set up event handlers
  setupResizeHandler(container, () => renderTreemap(container));
  document.removeEventListener("dimensionSwap", redrawHandler);
  document.addEventListener("dimensionSwap", redrawHandler);

  function redrawHandler() {
    renderTreemap(container);
  }
}

/**
 * Transforms data into hierarchical structure
 */
function processData(dimensions, measure) {
  const dataset = state.dataset;

  if (!dimensions?.length) {
    return d3.hierarchy({ name: "root", children: [] });
  }

  // Handle single dimension case
  if (dimensions.length === 1) {
    const hierarchy = {};
    dataset.forEach((d) => {
      const dimValue = d[dimensions[0]] || "Undefined";
      hierarchy[dimValue] = (hierarchy[dimValue] || 0) + (+d[measure] || 0);
    });

    const children = Object.entries(hierarchy)
      .map(([name, value], index) => ({ name, value, index }))
      .sort((a, b) => b.value - a.value);

    return d3.hierarchy({ name: "root", children }).sum((d) => d.value);
  }

  // Handle two dimensions case
  const nestedData = {};
  dataset.forEach((d) => {
    const dim1 = d[dimensions[0]] || "Undefined";
    const dim2 = d[dimensions[1]] || "Undefined";

    if (!nestedData[dim1]) nestedData[dim1] = {};
    nestedData[dim1][dim2] = (nestedData[dim1][dim2] || 0) + (+d[measure] || 0);
  });

  const children = Object.entries(nestedData)
    .map(([name, values]) => ({
      name,
      children: Object.entries(values)
        .map(([childName, value]) => ({ name: childName, value }))
        .sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => {
      const aTotal = a.children.reduce((sum, child) => sum + child.value, 0);
      const bTotal = b.children.reduce((sum, child) => sum + child.value, 0);
      return bTotal - aTotal;
    });

  return d3.hierarchy({ name: "root", children }).sum((d) => d.value);
}

/**
 * Renders treemap cells
 */
function renderCells(container, svg, root, dimensions, measure) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const tooltip = chartStyles.createTooltip();
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Configure treemap layout
  const treemap = d3
    .treemap()
    .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
    .paddingOuter(3)
    .paddingTop(dimensions.length > 1 ? 19 : 0)
    .paddingInner(dimensions.length > 1 ? 2 : 1)
    .round(true);

  treemap(root);

  // Create cell groups
  const cell = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll("g")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  // Add rectangles and labels
  addRectangles(cell, dimensions, colorScale, tooltip, measure, root.value);
  addCellLabels(cell, dimensions);
}

/**
 * Adds rectangle elements
 */
function addRectangles(cell, dimensions, colorScale, tooltip, measure, totalValue) {
  cell
    .append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("fill", (d) => getCellColor(d, dimensions, colorScale))
    .attr("stroke", (d) => (dimensions.length > 1 && d.depth === 2 ? d.parent.data.color : "#fff"))
    .attr("stroke-width", (d) => (dimensions.length > 1 && d.depth === 2 ? 1 : 0.5))
    .attr("opacity", 0.9)
    .attr("rx", 2)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("stroke-width", 2);
      chartStyles.showTooltip(tooltip, event, getTooltipContent(d, dimensions, measure, totalValue));
    })
    .on("mouseout", function () {
      d3.select(this)
        .attr("opacity", 0.9)
        .attr("stroke-width", (d) => (dimensions.length > 1 && d.depth === 2 ? 1 : 0.5));
      chartStyles.hideTooltip(tooltip);
    });
}

/**
 * Determines cell color
 */
function getCellColor(d, dimensions, colorScale) {
  // Single dimension chart
  if (dimensions.length <= 1) {
    if (d.depth === 0 || d.depth !== 1) return "#ddd";

    const siblings = [...d.parent.children].sort((a, b) => b.value - a.value);
    const index = siblings.indexOf(d);
    if (index === -1) return "#ddd";

    const baseColor = "#5E679B";
    const lightGray = "#f0f0f0";
    const normalizedValue = 1 - index / (siblings.length - 1 || 1);

    return d3.interpolate(lightGray, baseColor)(normalizedValue);
  }

  // Two dimension chart
  switch (d.depth) {
    case 1:
      d.data.color = colorScale(d.data.name);
      return d.data.color;
    case 2:
      return d3.color(d.parent.data.color).brighter(0.7);
    default:
      return "#ddd";
  }
}

/**
 * Creates tooltip content
 */
function getTooltipContent(d, dimensions, measure, totalValue) {
  const shareOfTotal = ((d.value / totalValue) * 100).toFixed(1);

  if (dimensions.length > 1 && d.depth === 2) {
    const parentValue = d.parent.value;
    const shareOfParent = ((d.value / parentValue) * 100).toFixed(1);

    return `
      <strong>${d.parent.data.name} › ${d.data.name}</strong><br>
      ${measure}: ${formatValue(d.value)}<br>
      Share of total: ${shareOfTotal}%<br>
      Share of ${d.parent.data.name}: ${shareOfParent}%
    `;
  }

  return `
    <strong>${d.data.name}</strong><br>
    ${measure}: ${formatValue(d.value)}<br>
    Share of total: ${shareOfTotal}%
  `;
}

/**
 * Adds text labels to cells
 */
function addCellLabels(cell, dimensions) {
  // Group headers
  cell
    .append("text")
    .filter((d) => dimensions.length > 1 && d.depth === 1 && d.x1 - d.x0 > 30)
    .attr("x", 4)
    .attr("y", 13)
    .attr("font-size", "11px")
    .attr("font-weight", "bold")
    .attr("font-family", "Noto Sans, sans-serif")
    .attr("fill", "white")
    .text((d) => truncateLabel(d.data.name, Math.floor((d.x1 - d.x0) / 7)));

  // Cell labels
  cell
    .append("text")
    .filter((d) => {
      if (d.depth === 0 || (dimensions.length > 1 && d.depth === 1)) return false;
      const isLeaf = dimensions.length > 1 ? d.depth === 2 : d.depth === 1;
      return isLeaf && d.x1 - d.x0 > 60 && d.y1 - d.y0 > 25;
    })
    .attr("x", 4)
    .attr("y", 13)
    .attr("font-size", "11px")
    .attr("font-family", "Noto Sans, sans-serif")
    .attr("fill", function (d) {
      const bgColor =
        dimensions.length > 1 && d.depth === 2
          ? d3.color(d.parent.data.color).brighter(0.7)
          : getCellColor(d, dimensions, null);
      return getContrastingTextColor(bgColor);
    })
    .text((d) => truncateLabel(d.data.name, Math.floor((d.x1 - d.x0) / 7)));

  // Value labels
  cell
    .append("text")
    .filter((d) => {
      const isLeaf = dimensions.length > 1 ? d.depth === 2 : d.depth === 1;
      return isLeaf && d.x1 - d.x0 > 80 && d.y1 - d.y0 > 40;
    })
    .attr("x", 4)
    .attr("y", 30)
    .attr("font-size", "11px")
    .attr("font-family", "Noto Sans, sans-serif")
    .attr("fill", function (d) {
      const bgColor =
        dimensions.length > 1 && d.depth === 2
          ? d3.color(d.parent.data.color).brighter(0.7)
          : getCellColor(d, dimensions, null);
      return getContrastingTextColor(bgColor, 0.9);
    })
    .text((d) => formatValue(d.value));
}

/**
 * Determines contrasting text color
 */
function getContrastingTextColor(backgroundColor, opacity = 1) {
  const color = typeof backgroundColor === "string" ? d3.color(backgroundColor) : backgroundColor;
  if (!color) return `rgba(0, 0, 0, ${opacity})`;

  const r = color.r;
  const g = color.g;
  const b = color.b;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.6 ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
}

export default renderTreemap;
