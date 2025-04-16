import { state } from "../../state.js";

/**
 * Chart control utilities for reusable chart UI components
 */
export const chartControls = {
  /**
   * Initialize dimension swap control if applicable
   * @param {string} chartType - Current chart type
   * @returns {boolean} Whether swap was initialized
   */
  initDimensionSwap(chartType) {
    // Get compatible chart types - can expand this list as needed
    const swappableChartTypes = ["treemap", "grouped_bar_chart", "stacked_bar_chart"];

    // Check if current chart supports dimension swapping
    const supportsSwap = swappableChartTypes.includes(chartType);
    const hasTwoDimensions = state.aggregationDefinition?.dimensions?.length === 2;

    // Update UI control
    this.updateDimensionControls(supportsSwap && hasTwoDimensions);

    return supportsSwap && hasTwoDimensions;
  },

  /**
   * Get dimensions array with swapping if needed
   * @returns {Array} Dimensions array with proper ordering
   */
  getSwappableDimensions() {
    if (!state.aggregationDefinition?.dimensions) return [];

    const dimensions = [...state.aggregationDefinition.dimensions];

    if (dimensions.length === 2 && state.dimensionsSwapped) {
      return [dimensions[1], dimensions[0]];
    }

    return dimensions;
  },

  /**
   * Updates dimension swap control visibility
   * @param {boolean} show - Whether to show the control
   */
  updateDimensionControls(show) {
    const swapControl =
      document.querySelector(".viz-dimension-swap") || (show ? this.createDimensionSwapControl() : null);

    if (swapControl) {
      swapControl.style.display = show ? "block" : "none";

      // Update button state
      const swapButton = swapControl.querySelector(".dimension-swap-btn");
      if (swapButton) {
        swapButton.style.backgroundColor = state.dimensionsSwapped ? "var(--color-primary-light)" : "white";
        swapButton.style.borderColor = state.dimensionsSwapped ? "var(--color-primary)" : "var(--color-border)";
      }
    }
  },

  /**
   * Creates dimension swap control in sidebar
   * @private
   */
  createDimensionSwapControl() {
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

      // Update button appearance
      swapButton.style.backgroundColor = state.dimensionsSwapped ? "var(--color-primary-light)" : "white";
      swapButton.style.borderColor = state.dimensionsSwapped ? "var(--color-primary)" : "var(--color-border)";

      // Trigger visualization redraw via event
      const event = new CustomEvent("dimensionSwap", {
        detail: { swapped: state.dimensionsSwapped },
      });
      document.dispatchEvent(event);
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
  },
};
