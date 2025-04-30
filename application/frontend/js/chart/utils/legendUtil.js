import { chartStyles } from "./chartStyles.js";
import * as chartUtils from "./chartUtils.js";

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
    colorBox.style.borderRadius = "50%"; // Make it circular
    colorBox.style.border = "none"; // Remove border
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
 * Creates color swatches for a legend with universal chart highlighting
 */
export function createColorLegend(container, items, colorAccessor, options = {}, dimensionName, chartType = "line") {
  // Clear existing content
  container.innerHTML = "";

  // Default options
  const config = {
    itemHeight: 12,
    itemSpacing: 6,
    ...options,
  };

  // Create title if dimension name is provided
  if (dimensionName) {
    const title = document.createElement("div");
    title.textContent = chartUtils.getDisplayName(dimensionName);
    title.style.fontWeight = "regular";
    title.style.marginBottom = "8px";
    title.style.fontSize = "13px";
    container.appendChild(title);
  }

  // Create legend items with highlighting capability
  items.forEach((item) => {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      marginBottom: `${config.itemSpacing}px`,
      padding: "4px 6px",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "background-color 0.2s ease",
    });

    // Color circle container (guarantees shape)
    const circleContainer = document.createElement("div");
    Object.assign(circleContainer.style, {
      flexShrink: "0", // Prevent flex shrinking
      width: `${config.itemHeight}px`,
      height: `${config.itemHeight}px`,
      marginRight: "8px",
      position: "relative", // For positioning the inner circle
    });

    // Actual circle
    const circle = document.createElement("div");
    Object.assign(circle.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundColor: colorAccessor(item),
      borderRadius: "50%",
      border: "none",
    });

    circleContainer.appendChild(circle);
    row.appendChild(circleContainer);

    // Text label
    const label = document.createElement("span");
    label.textContent = item;
    label.style.fontSize = "12px";

    // Universal highlighting logic for all chart types
    row.addEventListener("mouseenter", () => {
      // Highlight legend item
      row.style.backgroundColor = "rgba(0,0,0,0.1)";

      // Find all elements with the group attribute and dim them
      const selector = getElementSelector(chartType);
      document.querySelectorAll(selector).forEach((element) => {
        const group = element.getAttribute("data-group");
        if (group === item) {
          // Highlight the matching element
          highlightElement(element, chartType);
          // Bring to front
          if (element.parentNode) element.parentNode.appendChild(element);

          // Show labels for the highlighted item
          document.querySelectorAll(`.label-${chartType}[data-group="${item}"]`).forEach((label) => {
            label.style.opacity = "1";
          });
        } else {
          // Dim other elements
          element.style.opacity = "0.25";
        }
      });
    });

    row.addEventListener("mouseleave", () => {
      // Reset legend item
      row.style.backgroundColor = "";

      // Reset all elements
      const selector = getElementSelector(chartType);
      document.querySelectorAll(selector).forEach((element) => {
        resetElement(element, chartType);
      });

      // Hide all labels
      document.querySelectorAll(`.label-${chartType}`).forEach((label) => {
        label.style.opacity = "0";
      });
    });

    row.appendChild(label);
    container.appendChild(row);
  });

  return container;
}

/**
 * Get appropriate element selector based on chart type
 */
function getElementSelector(chartType) {
  switch (chartType) {
    case "line":
      return "path[data-group]";
    case "area":
      return "path.area[data-group]";
    case "stackedBar":
    case "groupedBar":
      return "rect[data-group]";
    default:
      return "[data-group]"; // Generic fallback
  }
}

/**
 * Apply highlight styling to chart element
 */
function highlightElement(element, chartType) {
  // Reset opacity for all chart types
  element.style.opacity = "1";

  // Chart-specific highlight styles
  switch (chartType) {
    case "line":
      element.style.strokeWidth = "2px";
      break;
    case "area":
    case "stackedBar":
    case "groupedBar":
      break;
  }
}

/**
 * Reset element to default styling
 */
function resetElement(element, chartType) {
  // Reset opacity for all chart types
  element.style.opacity = "1";

  // Chart-specific reset styles
  switch (chartType) {
    case "line":
      element.style.strokeWidth = "2px";
      break;
    case "area":
      // Just reset opacity
      break;
    case "stackedBar":
    case "groupedBar":
      // Remove stroke
      element.style.stroke = "none";
      element.style.strokeWidth = "0";
      break;
  }
}
