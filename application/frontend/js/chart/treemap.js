import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js";

function renderTreemap(container) {
  // Clear container
  container.innerHTML = "";

  // Create controls container
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "chart-controls";
  container.appendChild(controlsDiv);

  // Add swap button only if we have 2 dimensions
  if (state.aggregationDefinition.dimensions.length === 2) {
    addSwapButton(controlsDiv, container);
  }

  // Extract data with dimension swapping if needed
  const { dimensions, measure, data } = prepareData(container);

  // Create and setup the treemap
  setupTreemap(container, dimensions, measure, data);
}

function addSwapButton(controlsDiv, container) {
  // Initialize swap flag
  container.swapDimensions = container.swapDimensions || false;

  const swapBtn = document.createElement("button");
  swapBtn.textContent = "Swap Dimensions";
  swapBtn.className = "chart-button";

  swapBtn.addEventListener("click", () => {
    container.swapDimensions = !container.swapDimensions;
    renderTreemap(container);
  });

  controlsDiv.appendChild(swapBtn);
}

function prepareData(container) {
  const dataset = state.dataset;
  const measure = state.aggregationDefinition.measures[0].alias;

  // Handle dimension swapping
  let dimensions = [...state.aggregationDefinition.dimensions];
  if (dimensions.length === 2 && container.swapDimensions) {
    dimensions.reverse();
  }

  return { dimensions, measure, data: dataset };
}

function setupTreemap(container, dimensions, measure, dataset) {
  const width = CHART_DIMENSIONS.width;
  const height = CHART_DIMENSIONS.height;
  const margin = { top: 40, right: 10, bottom: 10, left: 10 };

  // Create SVG
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  // Create tooltip
  const tooltip = chartStyles.createTooltip();

  // Process data for treemap
  const root = processData(dimensions, measure, dataset);

  // Create color scale for parent nodes
  const parentColorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Create treemap layout with better padding for hierarchy
  const treemap = d3
    .treemap()
    .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
    .paddingOuter(3)
    .paddingTop(dimensions.length > 1 ? 19 : 0) // Add padding for headers
    .paddingInner(dimensions.length > 1 ? 2 : 1) // More padding between groups
    .round(true);

  // Apply the treemap layout
  treemap(root);

  // Add cells
  const cell = svg
    .selectAll("g")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${d.x0 + margin.left},${d.y0 + margin.top})`);

  // Add rectangles with improved styling for hierarchy
  cell
    .append("rect")
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => {
      // For two dimensions: parent nodes get unique colors, children get lighter versions
      if (dimensions.length > 1) {
        if (d.depth === 1) {
          // Store color on the data for children to access
          d.data.color = parentColorScale(d.data.name);
          return d.data.color;
        } else if (d.depth === 2) {
          // Get parent color and make it lighter
          const parentColor = d.parent.data.color;
          return d3.color(parentColor).brighter(0.7);
        }
        return "#ddd"; // Root node
      } else {
        // Single dimension - use category colors
        return d.depth === 1 ? d3.schemeCategory10[d.data.index % 10] : "#ddd";
      }
    })
    .attr("stroke", (d) => (dimensions.length > 1 && d.depth === 2 ? d.parent.data.color : "#fff")) // Use parent color for border of children
    .attr("stroke-width", (d) => (dimensions.length > 1 && d.depth === 2 ? 1 : 0.5))
    .attr("opacity", 0.9)
    .attr("rx", 2) // Slightly rounded corners
    .on("mouseover", function (event, d) {
      // Highlight on hover
      d3.select(this).attr("opacity", 1).attr("stroke-width", 2);

      let content;
      const totalValue = root.value; // Total value of entire treemap
      const shareOfTotal = ((d.value / totalValue) * 100).toFixed(1); // Overall percentage

      if (dimensions.length > 1 && d.depth === 2) {
        // For two dimensions: show both overall share and share within parent category
        const parentValue = d.parent.value;
        const shareOfParent = ((d.value / parentValue) * 100).toFixed(1); // Percentage within parent

        content = `
          <strong>${d.parent.data.name} › ${d.data.name}</strong><br>
          ${measure}: ${d.value.toLocaleString()}<br>
          Share of total: ${shareOfTotal}%<br>
          Share of ${d.parent.data.name}: ${shareOfParent}%
        `;
      } else if (dimensions.length > 1 && d.depth === 1) {
        // For parent nodes in two dimensions
        content = `
          <strong>${d.data.name}</strong><br>
          ${measure}: ${d.value.toLocaleString()}<br>
          Share of total: ${shareOfTotal}%
        `;
      } else {
        // For single dimension
        content = `
          <strong>${d.data.name}</strong><br>
          ${measure}: ${d.value.toLocaleString()}<br>
          Share of total: ${shareOfTotal}%
        `;
      }
      chartStyles.showTooltip(tooltip, event, content);
    })
    .on("mouseout", function () {
      // Reset on mouseout
      d3.select(this)
        .attr("opacity", 0.9)
        .attr("stroke-width", (d) => (dimensions.length > 1 && d.depth === 2 ? 1 : 0.5));
      chartStyles.hideTooltip(tooltip);
    });

  // Add title/header for groups
  cell
    .append("text")
    .filter((d) => dimensions.length > 1 && d.depth === 1)
    .attr("x", 4)
    .attr("y", 13)
    .attr("font-size", "11px")
    .attr("font-weight", "bold")
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", "white")
    .text((d) => d.data.name);

  // Add text labels for leaf nodes
  cell
    .append("text")
    .filter((d) => {
      if (dimensions.length > 1) {
        return d.depth === 2 && d.x1 - d.x0 > 50 && d.y1 - d.y0 > 20;
      } else {
        return d.depth === 1 && d.x1 - d.x0 > 50 && d.y1 - d.y0 > 20;
      }
    })
    .attr("x", 4)
    .attr("y", (d) => (dimensions.length > 1 && d.depth === 2 ? 13 : 13))
    .attr("font-size", "10px")
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => (dimensions.length > 1 && d.depth === 2 ? "#333" : "white"))
    .text((d) => d.data.name);

  // Add value labels for larger cells
  cell
    .append("text")
    .filter((d) => {
      const isLeaf = dimensions.length > 1 ? d.depth === 2 : d.depth === 1;
      return isLeaf && d.x1 - d.x0 > 80 && d.y1 - d.y0 > 40;
    })
    .attr("x", 4)
    .attr("y", (d) => (dimensions.length > 1 && d.depth === 2 ? 28 : 28))
    .attr("font-size", "9px")
    .attr("font-family", chartStyles.fontFamily)
    .attr("fill", (d) => (dimensions.length > 1 && d.depth === 2 ? "#555" : "rgba(255,255,255,0.8)"))
    .text((d) => d.value.toLocaleString());
}

function processData(dimensions, measure, dataset) {
  // Create hierarchical structure for treemap
  const hierarchy = {};

  if (dimensions.length === 1) {
    // Single dimension treemap
    dataset.forEach((d) => {
      const dimValue = d[dimensions[0]] || "Undefined";
      if (!hierarchy[dimValue]) {
        hierarchy[dimValue] = 0;
      }
      hierarchy[dimValue] += +d[measure] || 0;
    });

    const children = Object.entries(hierarchy).map(([name, value], index) => ({ name, value, index }));

    return d3.hierarchy({ name: "root", children }).sum((d) => d.value);
  } else {
    // Two dimension treemap
    const nestedData = {};

    dataset.forEach((d) => {
      const dim1 = d[dimensions[0]] || "Undefined";
      const dim2 = d[dimensions[1]] || "Undefined";

      if (!nestedData[dim1]) {
        nestedData[dim1] = {};
      }

      if (!nestedData[dim1][dim2]) {
        nestedData[dim1][dim2] = 0;
      }

      nestedData[dim1][dim2] += +d[measure] || 0;
    });

    const children = Object.entries(nestedData).map(([name, values], index) => {
      return {
        name,
        index,
        children: Object.entries(values).map(([childName, value]) => ({ name: childName, value })),
      };
    });

    return d3.hierarchy({ name: "root", children }).sum((d) => d.value);
  }
}

export default renderTreemap;
