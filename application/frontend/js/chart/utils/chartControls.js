import { state } from "../../state.js";

/**
 * Chart control utilities for reusable chart UI components
 */
export const chartControls = {
  //-------------------------------------------------------------------------
  // PUBLIC API
  //-------------------------------------------------------------------------

  /**
   * Initialize dimension swap control based on chart type
   * @param {string} chartType - Current chart type
   * @returns {boolean} Whether swap control was initialized
   */
  initDimensionSwap(chartType) {
    const swappableChartTypes = ["treemap", "grouped_bar_chart", "stacked_bar_chart", "nested_bar_chart"];
    const hasTwoDimensions = state.aggregationDefinition?.dimensions?.length === 2;
    const shouldShowControl = swappableChartTypes.includes(chartType) && hasTwoDimensions;

    // Clean up existing control
    this.removeExistingControl();

    if (!shouldShowControl) {
      state.dimensionsSwapped = false;
      return false;
    }

    this._createDimensionSwapControl();
    return true;
  },

  /**
   * Get dimensions array with proper ordering based on swap state
   * @returns {Array} Dimensions array
   */
  getSwappableDimensions() {
    const dimensions = state.aggregationDefinition?.dimensions || [];

    if (dimensions.length === 2 && state.dimensionsSwapped) {
      return [dimensions[1], dimensions[0]];
    }

    return [...dimensions];
  },

  /**
   * Remove any existing dimension swap control
   * Note: This is used externally in visualizeData.js
   */
  removeExistingControl() {
    document.querySelector(".viz-dimension-swap")?.remove();
  },

  //-------------------------------------------------------------------------
  // PRIVATE HELPERS
  //-------------------------------------------------------------------------

  /**
   * Creates dimension swap control in sidebar
   * @private
   * @returns {HTMLElement|null} The created control or null if insertion failed
   */
  _createDimensionSwapControl() {
    const controlPanel = document.querySelector(".viz-controls");
    if (!controlPanel) return null;

    // Create control elements
    const swapSection = document.createElement("div");
    swapSection.className = "viz-dimension-swap";
    swapSection.style.marginBottom = "20px";
    swapSection.innerHTML = '<h3 class="control-heading">View Options</h3>';

    // Create and add button
    swapSection.appendChild(this._createSwapButton());

    // Insert into DOM in proper location
    const insertPoint = document.querySelector(".viz-definition");
    insertPoint ? controlPanel.insertBefore(swapSection, insertPoint) : controlPanel.appendChild(swapSection);

    return swapSection;
  },

  /**
   * Creates the swap button element
   * @private
   * @returns {HTMLElement} Button element
   */
  _createSwapButton() {
    const swapButton = document.createElement("button");
    swapButton.className = "dimension-swap-btn";

    // Create button with Material Icons - wrapped in container span for better alignment
    swapButton.innerHTML = `
      <div style="display: inline-flex; align-items: center; justify-content: center;">
        <span class="material-icons" style="font-size: 16px; margin-right: 6px;">swap_horiz</span>
        <span>Flip Categories</span>
      </div>
    `;

    // Apply initial styles
    this._applyButtonStyles(swapButton, false);

    swapButton.addEventListener("click", () => {
      // Show brief visual feedback when clicked
      this._applyButtonStyles(swapButton, true);

      // Toggle the actual state
      state.dimensionsSwapped = !state.dimensionsSwapped;

      // Return to normal styling after brief delay
      setTimeout(() => {
        this._applyButtonStyles(swapButton, false);
      }, 300);

      // Notify listeners
      document.dispatchEvent(
        new CustomEvent("dimensionSwap", {
          detail: { swapped: state.dimensionsSwapped },
        })
      );
    });

    return swapButton;
  },

  /**
   * Apply proper styles to the swap button
   * @private
   * @param {HTMLElement} button - The button to style
   * @param {boolean} isActive - Whether to show active styling
   */
  _applyButtonStyles(button, isActive) {
    Object.assign(button.style, {
      padding: "8px 12px",
      border: "1px solid var(--color-border)",
      borderRadius: "4px",
      backgroundColor: isActive ? "var(--color-primary-light)" : "white",
      borderColor: isActive ? "var(--color-primary)" : "var(--color-border)",
      cursor: "pointer",
      fontSize: "12px",
      width: "100%",
      textAlign: "center",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      transition: "all 0.15s ease",
    });
  },
};
