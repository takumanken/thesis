import { state } from "../../state.js";

/**
 * Chart control utilities for reusable chart UI components
 */
export const chartControls = {
  /**
   * Initialize dimension swap control based on chart type
   * @param {string} chartType - Current chart type
   * @returns {boolean} Whether swap control was initialized
   */
  initDimensionSwap(chartType) {
    // Define supported chart types
    const swappableChartTypes = ["treemap", "grouped_bar_chart", "stacked_bar_chart"];

    // Check eligibility conditions
    const supportsSwap = swappableChartTypes.includes(chartType);
    const hasTwoDimensions = state.aggregationDefinition?.dimensions?.length === 2;
    const shouldShowControl = supportsSwap && hasTwoDimensions;

    // Clean up existing control regardless of what happens next
    this.removeExistingControl();

    // Reset swap state if not eligible
    if (!shouldShowControl) {
      state.dimensionsSwapped = false;
      return false;
    }

    // Create the control
    this.createDimensionSwapControl();
    return true;
  },

  /**
   * Get dimensions array with proper ordering based on swap state
   * @returns {Array} Dimensions array
   */
  getSwappableDimensions() {
    const dimensions = state.aggregationDefinition?.dimensions || [];

    // Return swapped dimensions if applicable
    if (dimensions.length === 2 && state.dimensionsSwapped) {
      return [dimensions[1], dimensions[0]];
    }

    return [...dimensions];
  },

  /**
   * Remove any existing dimension swap control
   */
  removeExistingControl() {
    document.querySelector(".viz-dimension-swap")?.remove();
  },

  /**
   * Creates dimension swap control in sidebar
   */
  createDimensionSwapControl() {
    // Find insertion points
    const controlPanel = document.querySelector(".viz-controls");
    if (!controlPanel) return null;

    const chartDefSection = document.querySelector(".viz-definition");

    // Create control container
    const swapSection = document.createElement("div");
    swapSection.className = "viz-dimension-swap";
    swapSection.style.marginBottom = "20px";

    // Add heading
    swapSection.innerHTML = '<h3 class="control-heading">Dimension Order</h3>';

    // Create button
    const swapButton = this.createSwapButton();
    swapSection.appendChild(swapButton);

    // Insert into DOM
    if (chartDefSection) {
      controlPanel.insertBefore(swapSection, chartDefSection);
    } else {
      controlPanel.appendChild(swapSection);
    }

    return swapSection;
  },

  /**
   * Creates the swap button element
   * @private
   */
  createSwapButton() {
    const swapButton = document.createElement("button");
    swapButton.textContent = "Swap Dimensions";
    swapButton.className = "dimension-swap-btn";

    // Apply styles
    Object.assign(swapButton.style, {
      padding: "8px 12px",
      border: "1px solid var(--color-border)",
      borderRadius: "4px",
      backgroundColor: state.dimensionsSwapped ? "var(--color-primary-light)" : "white",
      borderColor: state.dimensionsSwapped ? "var(--color-primary)" : "var(--color-border)",
      cursor: "pointer",
      fontSize: "12px",
      width: "100%",
    });

    // Add click handler
    swapButton.addEventListener("click", () => this.handleSwapButtonClick(swapButton));

    return swapButton;
  },

  /**
   * Handles swap button clicks
   * @param {HTMLElement} button - The button element
   * @private
   */
  handleSwapButtonClick(button) {
    // Toggle state
    state.dimensionsSwapped = !state.dimensionsSwapped;

    // Update button appearance
    button.style.backgroundColor = state.dimensionsSwapped ? "var(--color-primary-light)" : "white";
    button.style.borderColor = state.dimensionsSwapped ? "var(--color-primary)" : "var(--color-border)";

    // Trigger redraw event
    document.dispatchEvent(
      new CustomEvent("dimensionSwap", {
        detail: { swapped: state.dimensionsSwapped },
      })
    );
  },
};
