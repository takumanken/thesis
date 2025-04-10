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
