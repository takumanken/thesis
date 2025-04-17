import { state } from "../../state.js";
import { chartStyles } from "./chartStyles.js"; // <-- add this at top

/**
 * Shared utility functions for chart components
 */

/**
 * Truncates text to specified length and adds ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum characters before truncation
 * @returns {string} Truncated text
 */
export function truncateLabel(text, maxLength = 25) {
  return text?.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

/**
 * Formats numeric values with K/M suffixes
 * @param {number} value - Number to format
 * @returns {string} Formatted value
 */
export function formatValue(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return value.toLocaleString();
}

/**
 * Creates a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Creates resize observer for chart containers
 * @param {HTMLElement} container - Chart container element
 * @param {Function} redrawFunction - Function to call on resize
 */
export function setupResizeHandler(container, redrawFunction) {
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
        redrawFunction();
      }
    }, 250)
  );

  observer.observe(container);
  container._resizeObserver = observer;
}

/**
 * Measure text width using DOM
 * @param {HTMLElement} container - Parent container
 * @param {string} text - Text to measure
 * @param {Object} options - Font options
 * @returns {number} Width in pixels
 */
export function measureTextWidth(container, text, options = {}) {
  const { fontSize = "11px", fontFamily = "Noto Sans, sans-serif", fontWeight = "normal" } = options;

  // Create temporary measuring element
  const svg = d3.select(container).append("svg").attr("width", 0).attr("height", 0);

  const tempText = svg
    .append("text")
    .attr("font-family", fontFamily)
    .attr("font-size", fontSize)
    .attr("font-weight", fontWeight)
    .style("opacity", 0)
    .text(text);

  // Get measurement
  const width = tempText.node().getComputedTextLength() || 0;

  // Clean up
  svg.remove();

  return width;
}

/**
 * Validates the rendering context for charts
 * @param {HTMLElement} container - DOM element to render the chart
 * @param {string} [noDataMessage="No data available to display"] - Custom message to display when no data
 * @returns {boolean} True if context is valid, false otherwise
 */
export function validateRenderingContext(container, noDataMessage = "No data available to display") {
  if (!container) {
    console.error("Container element is null or undefined");
    return false;
  }

  if (!state?.dataset?.length) {
    container.innerHTML = `<p>${noDataMessage}</p>`;
    return false;
  }

  container.innerHTML = "";
  return true;
}

// Store the current handler at module level
let currentDimensionSwapHandler = null;

/**
 * Sets up a dimension swap event handler
 * @param {Function} renderCallback - Function to call when dimensions are swapped
 */
export function setupDimensionSwapHandler(renderCallback) {
  // Always clean up previous handler if it exists
  if (currentDimensionSwapHandler) {
    document.removeEventListener("dimensionSwap", currentDimensionSwapHandler);
    currentDimensionSwapHandler = null;
  }

  // Create a debounced handler to prevent rapid executions
  currentDimensionSwapHandler = debounce(() => {
    const container = document.querySelector(".viz-container");
    if (container) renderCallback(container);
  }, 100);

  // Add the new handler
  document.addEventListener("dimensionSwap", currentDimensionSwapHandler);
}

/**
 * Attach heatmap‑style hover + tooltip to any D3 selection.
 *
 * @param {d3.Selection} sel         – the elements to hover
 * @param {d3.Selection} tooltip     – created via chartStyles.createTooltip()
 * @param {Function}      contentFn  – (d, el, event) ⇒ HTML string
 * @param {Function}      [highlight]– (el, d) ⇒ void, e.g. style change
 */
export function attachMouseTooltip(sel, tooltip, contentFn, highlight) {
  let lastEl = null; // <-- declare per‐call state

  sel
    .on("mousemove", function (event, d) {
      // clear previous hover
      if (lastEl && lastEl !== this) {
        d3.select(lastEl).classed("hovered", false);
      }
      d3.select(this).classed("hovered", true);
      lastEl = this;

      if (highlight) highlight(d3.select(this), d);

      // show / move tooltip
      const html = contentFn(d, this, event);
      chartStyles.tooltip.show(tooltip, event, html);
    })
    .on("mouseout", function () {
      d3.select(this).classed("hovered", false);
      if (highlight) highlight(d3.select(this), null);
      chartStyles.tooltip.hide(tooltip);
      lastEl = null;
    });
}
