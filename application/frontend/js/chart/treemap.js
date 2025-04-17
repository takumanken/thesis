import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import {
  truncateLabel,
  formatValue,
  setupResizeHandler,
  validateRenderingContext,
  setupDimensionSwapHandler,
  attachMouseTooltip,
} from "./utils/chartUtils.js";
import { chartControls } from "./utils/chartControls.js";

// Constants
const DEFAULT_HEIGHT = 500;
const CELL_PADDING = { outer: 3, inner: 2, top: 19 };
const MARGIN = { top: 10, right: 10, bottom: 10, left: 10 };

/**
 * Set up event handlers for treemap
 * @param {HTMLElement} container - Container element
 */
function setupEventHandlers(container) {
  setupResizeHandler(container, () => renderTreemap(container));
  setupDimensionSwapHandler(renderTreemap);
}

/**
 * Renders a treemap visualization
 */
function renderTreemap(container) {
  // Validate input and set up container
  if (!validateRenderingContext(container)) return;

  // Clear and configure container step is already handled by validateRenderingContext
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${DEFAULT_HEIGHT}px`,
  });

  // Get dimensions with potential swapping
  chartControls.initDimensionSwap("treemap");
  const dimensions = chartControls.getSwappableDimensions();
  const measure = state.aggregationDefinition.measures[0].alias;

  // Create visualization
  const svg = createSvg(container);
  const hierarchyData = processData(dimensions, measure);
  renderCells(container, svg, hierarchyData, dimensions, measure);

  // Set up event handlers
  setupEventHandlers(container);
}

/**
 * Creates SVG element
 */
function createSvg(container) {
  return d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "98%")
    .attr("class", "viz-treemap-canvas");
}

/**
 * Transforms data into hierarchical structure
 */
function processData(dimensions, measure) {
  if (!dimensions?.length) {
    return d3.hierarchy({ name: "root", children: [] });
  }

  // Handle single dimension
  if (dimensions.length === 1) {
    return processSingleDimension(dimensions[0], measure);
  }

  // Handle two dimensions
  return processMultiDimensions(dimensions, measure);
}

/**
 * Processes single dimension data
 */
function processSingleDimension(dimension, measure) {
  const hierarchy = {};

  // Group and sum values
  state.dataset.forEach((d) => {
    const dimValue = d[dimension] || "Undefined";
    hierarchy[dimValue] = (hierarchy[dimValue] || 0) + (+d[measure] || 0);
  });

  // Convert to array and sort by value
  const children = Object.entries(hierarchy)
    .map(([name, value], index) => ({ name, value, index }))
    .sort((a, b) => b.value - a.value);

  return d3.hierarchy({ name: "root", children }).sum((d) => d.value);
}

/**
 * Processes multi-dimension data
 */
function processMultiDimensions(dimensions, measure) {
  const nestedData = {};

  // Create nested structure
  state.dataset.forEach((d) => {
    const dim1 = d[dimensions[0]] || "Undefined";
    const dim2 = d[dimensions[1]] || "Undefined";

    if (!nestedData[dim1]) nestedData[dim1] = {};
    nestedData[dim1][dim2] = (nestedData[dim1][dim2] || 0) + (+d[measure] || 0);
  });

  // Create hierarchical structure
  const children = Object.entries(nestedData)
    .map(([name, values]) => {
      // Sort children by value
      const childNodes = Object.entries(values)
        .map(([childName, value]) => ({ name: childName, value }))
        .sort((a, b) => b.value - a.value);

      return { name, children: childNodes };
    })
    // Sort parents by total value
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
  const tooltip = chartStyles.createTooltip();
  const colorScale = chartColors.getColorScale("categorical");

  // Configure treemap layout
  const treemap = d3
    .treemap()
    .size([width - MARGIN.left - MARGIN.right, height - MARGIN.top - MARGIN.bottom])
    .paddingOuter(CELL_PADDING.outer)
    .paddingTop(dimensions.length > 1 ? CELL_PADDING.top : 0)
    .paddingInner(dimensions.length > 1 ? CELL_PADDING.inner : 1)
    .round(true);

  // Apply layout
  treemap(root);

  // Create cell groups
  const cell = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)
    .selectAll("g")
    .data(
      // Filter out root node for multi-level treemaps
      dimensions.length > 1 ? root.descendants().filter((d) => d.depth > 0) : root.descendants()
    )
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  // Add visuals
  addRectangles(cell, dimensions, colorScale, tooltip, measure, root.value);
  addCellLabels(cell, dimensions);
}

/**
 * Adds rectangle elements
 */
function addRectangles(cell, dimensions, colorScale, tooltip, measure, totalValue) {
  const areas = cell
    .append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("fill", (d) => getCellColor(d, dimensions, colorScale))
    .attr("stroke", (d) => getStrokeColor(d, dimensions))
    .attr("stroke-width", (d) => getStrokeWidth(d, dimensions))
    .attr("opacity", 0.9)
    .attr("rx", 2);

  attachMouseTooltip(
    areas,
    tooltip,
    // use your helper to build HTML
    (d) => getTooltipContent(d, dimensions, measure, totalValue),
    // simple highlight: full opacity & thicker stroke on hover
    (el, d) => {
      if (d) {
        el.attr("opacity", 1).attr("stroke-width", 2);
      } else {
        el.attr("opacity", 0.9).attr("stroke-width", getStrokeWidth(el.datum(), dimensions));
      }
    }
  );
}

/**
 * Gets stroke color for cell
 */
function getStrokeColor(d, dimensions) {
  return dimensions.length > 1 && d.depth === 2 ? d.parent.data.color : "#fff";
}

/**
 * Gets stroke width for cell
 */
function getStrokeWidth(d, dimensions) {
  return dimensions.length > 1 && d.depth === 2 ? 1 : 0.5;
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

    // Create gradient from light to base color
    const baseColor = chartColors.sequential.blue.base; // "#9EAADB"
    const lightGray = chartColors.sequential.blue.light; // "#f0f0f0"
    const normalizedValue = 1 - index / (siblings.length - 1 || 1);

    return d3.interpolate(lightGray, baseColor)(normalizedValue);
  }

  // Two dimension chart
  switch (d.depth) {
    case 1:
      // Set color from palette for parent
      d.data.color = colorScale(d.data.name);
      return d.data.color;
    case 2:
      // Make children lighter than parent
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

  // Child node in two-dimension treemap
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

  // Parent node or single-dimension cell
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
  addHeaderLabels(cell, dimensions);
  addNameLabels(cell, dimensions);
  addValueLabels(cell, dimensions);
}

/**
 * Adds header labels to parent cells
 */
function addHeaderLabels(cell, dimensions) {
  cell
    .append("text")
    .filter((d) => dimensions.length > 1 && d.depth === 1 && d.x1 - d.x0 > 30)
    .attr("x", 4)
    .attr("y", 13)
    .attr("font-size", "11px")
    .attr("font-weight", "bold")
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => chartStyles.getContrastingTextColor(d.data.color || "#ddd"))
    .text((d) => truncateLabel(d.data.name, Math.floor((d.x1 - d.x0) / 7)));
}

/**
 * Adds name labels to cells
 */
function addNameLabels(cell, dimensions) {
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
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => {
      const bgColor =
        dimensions.length > 1 && d.depth === 2
          ? d3.color(d.parent.data.color).brighter(0.7)
          : getCellColor(d, dimensions, null);
      return chartStyles.getContrastingTextColor(bgColor);
    })
    .text((d) => truncateLabel(d.data.name, Math.floor((d.x1 - d.x0) / 7)));
}

/**
 * Adds value labels to cells
 */
function addValueLabels(cell, dimensions) {
  cell
    .append("text")
    .filter((d) => {
      const isLeaf = dimensions.length > 1 ? d.depth === 2 : d.depth === 1;
      return isLeaf && d.x1 - d.x0 > 80 && d.y1 - d.y0 > 40;
    })
    .attr("x", 4)
    .attr("y", 30)
    .attr("font-size", "11px")
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => {
      const bgColor =
        dimensions.length > 1 && d.depth === 2
          ? d3.color(d.parent.data.color).brighter(0.7)
          : getCellColor(d, dimensions, null);
      return chartStyles.getContrastingTextColor(bgColor, 0.9);
    })
    .text((d) => formatValue(d.value));
}

export default renderTreemap;
