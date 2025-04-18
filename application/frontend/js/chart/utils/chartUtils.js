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
 * Attach heatmap-style hover + tooltip to any D3 selection.
 * Provides consistent tooltip behavior with automatic "darker fill" highlight
 * unless a custom highlight function is provided.
 *
 * @param {d3.Selection} sel - D3 selection to attach hover behavior to
 * @param {d3.Selection} tooltip - Tooltip element created via chartStyles.createTooltip()
 * @param {Function} contentFn - Function(d, element, event) that returns HTML content
 * @param {Function} [highlightFn] - Optional custom highlight function(el, d)
 */
export function attachMouseTooltip(sel, tooltip, contentFn, highlightFn) {
  if (!sel || sel.empty()) {
    console.warn("attachMouseTooltip: Empty or invalid selection");
    return;
  }

  let lastEl = null;

  // Store original fill color for each element
  sel.each(function () {
    const el = d3.select(this);
    const fill = el.attr("fill");
    // Only store if fill exists
    if (fill) el.property("__origFill", fill);
  });

  // Default highlight that darkens fill when hovered
  function defaultHighlight(el, d) {
    // Get original fill - if undefined, do nothing
    const origFill = el.property("__origFill");
    if (!origFill) return;

    if (d) {
      // Highlight: darken the fill
      el.attr("fill", d3.color(origFill).darker(0.3));
    } else {
      // Reset to original
      el.attr("fill", origFill);
    }
  }

  // Handle mousemove (covers both mouseover and movement)
  sel.on("mousemove", function (event, d) {
    // Clear previous highlight
    if (lastEl && lastEl !== this) {
      const prev = d3.select(lastEl);
      (highlightFn || defaultHighlight)(prev, null);
    }

    // Apply new highlight
    const cur = d3.select(this);
    (highlightFn || defaultHighlight)(cur, d);
    lastEl = this;

    // Show tooltip with content
    const html = contentFn(d, this, event);
    if (html) {
      chartStyles.tooltip.show(tooltip, event, html);
    }
  });

  // Handle mouseout
  sel.on("mouseout", function () {
    // Clear highlight
    const cur = d3.select(this);
    (highlightFn || defaultHighlight)(cur, null);

    // Hide tooltip
    chartStyles.tooltip.hide(tooltip);
    lastEl = null;
  });
}
