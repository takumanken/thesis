/**
 * Treemap Chart Component
 * Displays hierarchical data with rectangles sized by measure value
 */
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

// ===== CONSTANTS =====
const CHART_CONFIG = {
  height: 500,
  margin: { top: 10, right: 10, bottom: 10, left: 10 },
  padding: {
    outer: 3, // Padding around the entire treemap
    inner: 2, // Padding between cells at same level
    top: 19, // Extra padding at top for parent labels
  },
  cell: {
    cornerRadius: 2,
    opacity: 0.9,
  },
  text: {
    minWidthForName: 60,
    minHeightForName: 25,
    minWidthForValue: 80,
    minHeightForValue: 40,
    fontSize: "11px",
  },
};

// ===== MAIN RENDERING FUNCTION =====

/**
 * Renders a treemap visualization
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderTreemap(container) {
  // Validate context and prepare container
  if (!validateRenderingContext(container)) return;

  // Configure container
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: `${CHART_CONFIG.height}px`,
  });

  // Extract dimensions and measure
  chartControls.initDimensionSwap("treemap");
  const dimensions = chartControls.getSwappableDimensions();
  const measure = state.aggregationDefinition.measures[0].alias;

  // Create visualization
  const svg = createSvg(container);
  const hierarchyData = processData(dimensions, measure);
  renderCells(container, svg, hierarchyData, dimensions, measure);

  // Set up event handlers
  setupResizeHandler(container, () => renderTreemap(container));
  setupDimensionSwapHandler(renderTreemap);
}

// ===== DATA PROCESSING =====

/**
 * Transforms data into hierarchical structure
 * @param {Array} dimensions - Dimension fields
 * @param {string} measure - Measure field
 * @returns {d3.hierarchy} Hierarchical data structure
 */
function processData(dimensions, measure) {
  if (!dimensions?.length) {
    return d3.hierarchy({ name: "root", children: [] });
  }

  return dimensions.length === 1
    ? processSingleDimension(dimensions[0], measure)
    : processMultiDimensions(dimensions, measure);
}

/**
 * Processes single dimension data
 */
function processSingleDimension(dimension, measure) {
  const valuesByDimension = {};

  // Group and sum values
  state.dataset.forEach((d) => {
    const dimValue = d[dimension] || "Undefined";
    valuesByDimension[dimValue] = (valuesByDimension[dimValue] || 0) + (+d[measure] || 0);
  });

  // Convert to array and sort by value
  const children = Object.entries(valuesByDimension)
    .map(([name, value]) => ({ name, value }))
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

  // Create hierarchical structure with ordering
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

// ===== CHART CREATION =====

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
 * Renders treemap cells
 */
function renderCells(container, svg, root, dimensions, measure) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const tooltip = chartStyles.createTooltip();
  const colorScale = chartColors.getColorScale("categorical");
  const { margin, padding } = CHART_CONFIG;

  // Determine if this is a multi-level treemap
  const isMultiLevel = dimensions.length > 1;

  // Configure treemap layout
  const treemap = d3
    .treemap()
    .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
    .paddingOuter(padding.outer)
    .paddingTop(isMultiLevel ? padding.top : 0)
    .paddingInner(isMultiLevel ? padding.inner : 1)
    .round(true);

  // Apply layout
  treemap(root);

  // Create cell groups, filtering nodes appropriately
  const cells = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .selectAll("g")
    .data(isMultiLevel ? root.descendants().filter((d) => d.depth > 0) : root.descendants())
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  // Add visual elements
  addRectangles(cells, dimensions, colorScale, tooltip, measure, root.value);
  addCellLabels(cells, dimensions);
}

// ===== CELL RENDERING =====

/**
 * Adds rectangle elements for each cell
 */
function addRectangles(cell, dimensions, colorScale, tooltip, measure, totalValue) {
  const { cell: cellConfig } = CHART_CONFIG;

  const areas = cell
    .append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("fill", (d) => getCellColor(d, dimensions, colorScale))
    .attr("stroke", (d) => {
      // Special case for child nodes in multi-level treemap
      if (dimensions.length > 1 && d.depth === 2) {
        return d.parent.data.color;
      }
      return "#fff";
    })
    .attr("stroke-width", (d) => (dimensions.length > 1 && d.depth === 2 ? 1 : 0.5))
    .attr("opacity", cellConfig.opacity)
    .attr("rx", cellConfig.cornerRadius);

  attachMouseTooltip(areas, tooltip, (d) => getTooltipContent(d, dimensions, measure, totalValue));
}

/**
 * Determines cell color based on depth and dimensions
 */
function getCellColor(d, dimensions, colorScale) {
  const isMultiLevel = dimensions.length > 1;

  // Handle root node
  if (d.depth === 0) return "#ddd";

  // Single dimension chart
  if (!isMultiLevel) {
    if (d.depth !== 1) return "#ddd";

    // Create gradient based on rank
    const siblings = [...d.parent.children].sort((a, b) => b.value - a.value);
    const index = siblings.indexOf(d);
    if (index === -1) return "#ddd";

    // Create gradient from light to base color
    const baseColor = chartColors.sequential.blue.base;
    const lightColor = chartColors.sequential.blue.light;
    const normalizedValue = 1 - index / (siblings.length - 1 || 1);

    return d3.interpolate(lightColor, baseColor)(normalizedValue);
  }

  // Two dimension chart
  if (d.depth === 1) {
    // Store color for parent node and return it
    d.data.color = colorScale(d.data.name);
    return d.data.color;
  } else if (d.depth === 2) {
    // Child nodes get a lighter version of parent color
    return d3.color(d.parent.data.color).brighter(0.7);
  }

  return "#ddd";
}

/**
 * Creates tooltip content for a cell
 */
function getTooltipContent(d, dimensions, measure, totalValue) {
  const shareOfTotal = ((d.value / totalValue) * 100).toFixed(1);

  // Child node in multi-level treemap
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

// ===== LABEL RENDERING =====

/**
 * Adds text labels to cells
 */
function addCellLabels(cell, dimensions) {
  addHeaderLabels(cell, dimensions);
  addNameLabels(cell, dimensions);
  addValueLabels(cell, dimensions);
}

/**
 * Adds header labels to parent cells in multi-level treemap
 */
function addHeaderLabels(cell, dimensions) {
  const { text } = CHART_CONFIG;
  const isMultiLevel = dimensions.length > 1;

  cell
    .append("text")
    .filter((d) => isMultiLevel && d.depth === 1 && d.x1 - d.x0 > 30)
    .attr("x", 4)
    .attr("y", 13)
    .attr("font-size", text.fontSize)
    .attr("font-weight", "bold")
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => chartStyles.getContrastingTextColor(d.data.color || "#ddd"))
    .text((d) => truncateLabel(d.data.name, Math.floor((d.x1 - d.x0) / 7)));
}

/**
 * Adds name labels to leaf cells
 */
function addNameLabels(cell, dimensions) {
  const { text } = CHART_CONFIG;
  const isMultiLevel = dimensions.length > 1;

  cell
    .append("text")
    .filter((d) => {
      // Skip root and parent nodes in multi-level
      if (d.depth === 0 || (isMultiLevel && d.depth === 1)) return false;

      // Determine if this is a leaf node
      const isLeaf = isMultiLevel ? d.depth === 2 : d.depth === 1;

      // Check if cell is large enough for label
      return isLeaf && d.x1 - d.x0 > text.minWidthForName && d.y1 - d.y0 > text.minHeightForName;
    })
    .attr("x", 4)
    .attr("y", 13)
    .attr("font-size", text.fontSize)
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => {
      // Get background color to calculate contrasting text color
      const bgColor =
        isMultiLevel && d.depth === 2 ? d3.color(d.parent.data.color).brighter(0.7) : getCellColor(d, dimensions, null);

      return chartStyles.getContrastingTextColor(bgColor);
    })
    .text((d) => truncateLabel(d.data.name, Math.floor((d.x1 - d.x0) / 7)));
}

/**
 * Adds value labels to cells large enough
 */
function addValueLabels(cell, dimensions) {
  const { text } = CHART_CONFIG;
  const isMultiLevel = dimensions.length > 1;

  cell
    .append("text")
    .filter((d) => {
      // Determine if this is a leaf node
      const isLeaf = isMultiLevel ? d.depth === 2 : d.depth === 1;

      // Only add value label to larger cells
      return isLeaf && d.x1 - d.x0 > text.minWidthForValue && d.y1 - d.y0 > text.minHeightForValue;
    })
    .attr("x", 4)
    .attr("y", 30)
    .attr("font-size", text.fontSize)
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => {
      // Get background color to calculate contrasting text color
      const bgColor =
        isMultiLevel && d.depth === 2 ? d3.color(d.parent.data.color).brighter(0.7) : getCellColor(d, dimensions, null);

      return chartStyles.getContrastingTextColor(bgColor, 0.9);
    })
    .text((d) => formatValue(d.value));
}

export default renderTreemap;
