import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";

/**
 * Renders a treemap visualization
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderTreemap(container) {
  if (!container || !state.dataset?.length) {
    if (container) container.innerHTML = "<p>No data available to display</p>";
    return;
  }

  // Setup and configuration
  container.innerHTML = "";
  configureContainer(container);
  updateDimensionControls();

  // Get dimensions and measure with potential swapping
  const dimensions = getDimensions();
  const measure = state.aggregationDefinition.measures[0].alias;

  // Create and configure visualization
  const svg = createSvg(container);
  const root = processData(dimensions, measure, state.dataset);
  renderTreemapCells(container, svg, root, dimensions, measure);

  // Add resize handling
  setupResizeHandler(container);
}

/**
 * Configures container styles
 */
function configureContainer(container) {
  Object.assign(container.style, {
    position: "relative",
    width: "100%",
    height: "500px",
  });
}

/**
 * Creates SVG element for treemap
 */
function createSvg(container) {
  return d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("class", "viz-treemap-canvas");
}

/**
 * Gets dimensions array with swapping if needed
 */
function getDimensions() {
  if (!state.aggregationDefinition?.dimensions) return [];

  const dimensions = [...state.aggregationDefinition.dimensions];

  if (dimensions.length === 2 && state.dimensionsSwapped) {
    return [dimensions[1], dimensions[0]];
  }

  return dimensions;
}

/**
 * Updates dimension swap control visibility
 */
function updateDimensionControls() {
  const hasTwoDimensions = state.aggregationDefinition?.dimensions?.length === 2;
  const swapControl =
    document.querySelector(".viz-dimension-swap") || (hasTwoDimensions ? createDimensionSwapControl() : null);

  if (swapControl) {
    swapControl.style.display = hasTwoDimensions ? "block" : "none";

    // Update button state
    const swapButton = swapControl.querySelector(".dimension-swap-btn");
    if (swapButton) {
      swapButton.style.backgroundColor = state.dimensionsSwapped ? "var(--color-primary-light)" : "white";
      swapButton.style.borderColor = state.dimensionsSwapped ? "var(--color-primary)" : "var(--color-border)";
    }
  }
}

/**
 * Creates dimension swap control in sidebar
 */
function createDimensionSwapControl() {
  const controlPanel = document.querySelector(".viz-controls");
  const chartDefSection = document.querySelector(".viz-definition");

  // Create control section
  const swapSection = document.createElement("div");
  swapSection.className = "viz-dimension-swap";
  swapSection.style.marginBottom = "20px";

  // Add heading
  const heading = document.createElement("h3");
  heading.className = "control-heading";
  heading.textContent = "Dimension Order";
  swapSection.appendChild(heading);

  // Add swap button
  const swapButton = document.createElement("button");
  swapButton.textContent = "Swap Dimensions";
  swapButton.className = "dimension-swap-btn";
  Object.assign(swapButton.style, {
    padding: "8px 12px",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    backgroundColor: "white",
    cursor: "pointer",
    fontSize: "12px",
    width: "100%",
  });

  // Add click handler
  swapButton.addEventListener("click", () => {
    state.dimensionsSwapped = !state.dimensionsSwapped;

    swapButton.style.backgroundColor = state.dimensionsSwapped ? "var(--color-primary-light)" : "white";
    swapButton.style.borderColor = state.dimensionsSwapped ? "var(--color-primary)" : "var(--color-border)";

    // Re-render the visualization
    const vizContainer = document.querySelector(".viz-container");
    if (vizContainer) renderTreemap(vizContainer);
  });

  swapSection.appendChild(swapButton);

  // Insert into DOM at correct position
  if (controlPanel) {
    if (chartDefSection) {
      controlPanel.insertBefore(swapSection, chartDefSection);
    } else {
      controlPanel.appendChild(swapSection);
    }
  }

  return swapSection;
}

/**
 * Process data into hierarchical structure for treemap
 */
function processData(dimensions, measure, dataset) {
  if (!dimensions?.length) {
    return d3.hierarchy({ name: "root", children: [] });
  }

  // Single dimension case
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
  // Two dimensions case
  else {
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
}

/**
 * Renders treemap cells with colors, labels and tooltips
 */
function renderTreemapCells(container, svg, root, dimensions, measure) {
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

  // Add rectangles
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
      chartStyles.showTooltip(tooltip, event, getTooltipContent(d, dimensions, measure, root.value));
    })
    .on("mouseout", function () {
      d3.select(this)
        .attr("opacity", 0.9)
        .attr("stroke-width", (d) => (dimensions.length > 1 && d.depth === 2 ? 1 : 0.5));
      chartStyles.hideTooltip(tooltip);
    });

  // Add labels
  addTreemapLabels(cell, dimensions);
}

/**
 * Determines color for a treemap cell
 */
function getCellColor(d, dimensions, colorScale) {
  if (dimensions.length <= 1) {
    return d.depth === 1 ? colorScale(d.data.index) : "#ddd";
  }

  if (d.depth === 1) {
    // Store color for children to access
    d.data.color = colorScale(d.data.name);
    return d.data.color;
  } else if (d.depth === 2) {
    return d3.color(d.parent.data.color).brighter(0.7);
  }

  return "#ddd"; // Root node
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
 * Adds labels to treemap cells
 */
function addTreemapLabels(cell, dimensions) {
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

  // Cell labels - FIX HERE
  cell
    .append("text")
    .filter((d) => {
      // Skip root node and parent headers that already have labels
      if (d.depth === 0 || (dimensions.length > 1 && d.depth === 1)) {
        return false;
      }

      // Only show labels on cells with enough space
      const isLeafNode = dimensions.length > 1 ? d.depth === 2 : d.depth === 1;
      return isLeafNode && d.x1 - d.x0 > 60 && d.y1 - d.y0 > 25;
    })
    .attr("x", 4)
    .attr("y", 13)
    .attr("font-size", "10px")
    .attr("font-family", "Noto Sans, sans-serif")
    .attr("fill", (d) => (dimensions.length > 1 && d.depth === 2 ? "#333" : "white"))
    .text((d) => truncateLabel(d.data.name, Math.floor((d.x1 - d.x0) / 7)));

  // Value labels (for larger cells only)
  cell
    .append("text")
    .filter((d) => {
      const isLeaf = dimensions.length > 1 ? d.depth === 2 : d.depth === 1;
      return isLeaf && d.x1 - d.x0 > 80 && d.y1 - d.y0 > 40;
    })
    .attr("x", 4)
    .attr("y", 28)
    .attr("font-size", "9px")
    .attr("font-family", "Noto Sans, sans-serif")
    .attr("fill", (d) => (dimensions.length > 1 && d.depth === 2 ? "#555" : "rgba(255,255,255,0.8)"))
    .text((d) => formatValue(d.value));
}

/**
 * Set up resize handler
 */
function setupResizeHandler(container) {
  if (container._resizeObserver) {
    container._resizeObserver.disconnect();
  }

  const observer = new ResizeObserver(
    debounce(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width > 0 && height > 0 && (width !== container._lastWidth || height !== container._lastHeight)) {
        container._lastWidth = width;
        container._lastHeight = height;
        renderTreemap(container);
      }
    }, 250)
  );

  observer.observe(container);
  container._resizeObserver = observer;
}

/**
 * Utility functions
 */
function truncateLabel(text, maxLength = 25) {
  return text?.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function formatValue(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return value.toLocaleString();
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export default renderTreemap;
