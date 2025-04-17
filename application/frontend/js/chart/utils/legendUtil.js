import { chartStyles } from "./chartStyles.js";

/**
 * Creates a legend beside the chart in a fixed layout
 * @param {HTMLElement} container - The parent container
 * @param {Array} items - Legend items array
 * @param {Function} colorScale - D3 color scale function
 * @returns {Object} Object containing chartArea and legendDiv
 */
export function createLegend(container, items, colorScale) {
  container.innerHTML = "";

  // Create flex container with 80/20 split
  const flexContainer = document.createElement("div");
  flexContainer.style.display = "flex";
  flexContainer.style.width = "100%";
  flexContainer.style.height = "100%";

  // Chart area (80%)
  const chartArea = document.createElement("div");
  chartArea.className = "chart-area";
  chartArea.style.width = "80%";

  // Legend area (20%)
  const legendDiv = document.createElement("div");
  legendDiv.className = "chart-legend";
  legendDiv.style.width = "20%";
  legendDiv.style.padding = "10px";
  legendDiv.style.overflowY = "auto";
  legendDiv.style.borderLeft = "1px solid #ddd";

  // Add legend items
  items.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.style.display = "flex";
    itemDiv.style.alignItems = "center";
    itemDiv.style.marginBottom = "8px";

    // Color box
    const colorBox = document.createElement("span");
    colorBox.style.width = "15px";
    colorBox.style.height = "15px";
    colorBox.style.backgroundColor = colorScale(item);
    colorBox.style.border = "1px solid #000";
    colorBox.style.marginRight = "8px";

    // Label
    const label = document.createElement("span");
    label.style.fontSize = chartStyles.fontSize.legend;
    label.style.fontFamily = chartStyles.fontFamily;
    label.style.color = "#333";
    label.textContent = item;

    itemDiv.appendChild(colorBox);
    itemDiv.appendChild(label);
    legendDiv.appendChild(itemDiv);
  });

  // Assemble the layout
  flexContainer.appendChild(chartArea);
  flexContainer.appendChild(legendDiv);
  container.appendChild(flexContainer);

  return { chartArea, legendDiv };
}

/**
 * Creates a horizontal chart-legend layout
 * @param {HTMLElement} container - The parent container
 * @param {Object} options - Layout configuration options
 * @returns {Object} References to chart and legend containers
 */
export function createHorizontalLayout(container, options = {}) {
  // Default configuration
  const config = {
    chartWidth: "85%",
    legendWidth: "15%",
    ...options,
  };

  // Clear the container first
  container.innerHTML = "";

  // Create layout elements
  const chartContainer = document.createElement("div");
  chartContainer.className = "viz-chart-area";

  const legendContainer = document.createElement("div");
  legendContainer.className = "viz-legend-area";

  // Apply layout styling
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    height: "100%", // Set parent container to 100% height too
  });

  Object.assign(chartContainer.style, {
    width: config.chartWidth,
    position: "relative",
    height: "100%", // Set chart container to 100% height
  });

  Object.assign(legendContainer.style, {
    width: config.legendWidth,
    padding: "10px 0 10px 10px",
    height: "100%", // Make legend 100% height too for consistency
  });

  // Add to DOM
  container.appendChild(chartContainer);
  container.appendChild(legendContainer);

  return { chartContainer, legendContainer };
}

/**
 * Creates color swatches for a legend
 * @param {HTMLElement} container - Legend container
 * @param {Array} items - Items to include in legend
 * @param {Function} colorAccessor - Function that returns color for an item
 * @param {Object} options - Additional options
 */
export function createColorLegend(container, items, colorAccessor, options = {}) {
  // Default options
  const config = {
    title: "Legend",
    showTitle: items.length > 0,
    itemHeight: 12,
    itemSpacing: 6,
    ...options,
  };

  // Create title if needed
  if (config.showTitle) {
    const heading = document.createElement("h3");
    heading.textContent = config.title;
    Object.assign(heading.style, {
      fontSize: "14px",
      margin: "0 0 8px 0",
      fontWeight: "500",
      fontFamily: chartStyles.fontFamily,
    });
    container.appendChild(heading);
  }

  // Create legend items
  items.forEach((item) => {
    const itemContainer = document.createElement("div");
    Object.assign(itemContainer.style, {
      display: "flex",
      alignItems: "center",
      marginBottom: `${config.itemSpacing}px`,
    });

    // Color swatch
    const colorBox = document.createElement("span");
    Object.assign(colorBox.style, {
      display: "inline-block",
      width: `${config.itemHeight}px`,
      height: `${config.itemHeight}px`,
      backgroundColor: colorAccessor(item),
      marginRight: "5px",
      border: "1px solid #ccc",
    });

    // Text label
    const label = document.createElement("span");
    label.textContent = item;
    Object.assign(label.style, {
      fontSize: "12px",
      fontFamily: chartStyles.fontFamily,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });

    itemContainer.appendChild(colorBox);
    itemContainer.appendChild(label);
    container.appendChild(itemContainer);
  });

  return container;
}
