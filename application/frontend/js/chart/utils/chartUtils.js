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
 * Formats numeric values with thousands separators without abbreviation
 * @param {number|string} value - Number to format
 * @param {number} [decimals=0] - Number of decimal places
 * @returns {string} Formatted value with thousands separators
 */
export function formatFullNumber(value, decimals = 0) {
  // Handle null, undefined and non-numeric values
  if (value === null || value === undefined || value === "") return "";

  // Parse the value to a number
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return value;

  // Format with thousands separators and specified decimals
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
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

    // Use the centralized cleanup utility
    cleanupOrphanedTooltips();

    if (container) renderCallback(container);
  }, 100);

  // Add the new handler
  document.addEventListener("dimensionSwap", currentDimensionSwapHandler);
}

/**
 * Cleanup orphaned tooltips in the DOM
 * Keeps only the singleton tooltip and removes all others
 */
export function cleanupOrphanedTooltips() {
  const tooltips = d3.selectAll(".chart-tooltip");
  if (tooltips.size() > 1) {
    tooltips.each(function () {
      if (this.id !== "chart-tooltip-singleton") {
        d3.select(this).remove();
      }
    });
  }
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

/**
 * Determine the time grain from dimension name
 * @param {string} timeDimension - Name of the time dimension
 * @returns {string} Time grain: 'year', 'month', 'week', or 'day'
 */
export function determineTimeGrain(timeDimension) {
  const dimensionLower = timeDimension?.toLowerCase() || "";

  if (dimensionLower.includes("year")) return "year";
  if (dimensionLower.includes("month")) return "month";
  if (dimensionLower.includes("week")) return "week";
  return "day"; // Default
}

/**
 * Format time value for display
 * @param {Date|number} time - Time value
 * @param {boolean} isNumericTime - Whether time is numeric
 * @returns {string} Formatted time string
 */
export function formatTimeValue(time, isNumericTime) {
  return isNumericTime ? time : d3.timeFormat("%Y-%m-%d")(time);
}

/**
 * Find closest data point to mouse position
 * @param {number} mouseX - Mouse X position
 * @param {number|d3.Scale} secondParam - Either mouseY or xScale depending on context
 * @param {Array} data - Dataset or points array
 * @returns {Object|null} Closest data point
 */
export function findClosestDataPoint(mouseX, secondParam, data) {
  // If we're dealing with x/y coordinates (from line_chart.js)
  if (typeof secondParam === "number") {
    const mouseY = secondParam;

    if (!data?.length) return null;

    let closestPoint = null;
    let minDistance = Infinity;

    data.forEach((point) => {
      const dx = point.x - mouseX;
      const dy = point.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = { ...point, distance };
      }
    });

    return closestPoint;
  }
  // If we're dealing with a scale object (from stacked_area_chart.js)
  else if (secondParam && typeof secondParam.invert === "function") {
    const xScale = secondParam;
    const timeField = arguments[3] || "time"; // Get optional 4th parameter

    if (!data?.length) return null;

    const date = xScale.invert(mouseX);
    const bisect = d3.bisector((d) => d[timeField]).left;
    const index = bisect(data, date);

    // Handle edge cases
    if (index === 0) return data[0];
    if (index >= data.length) return data[data.length - 1];

    // Determine which point is closer
    const d0 = data[index - 1];
    const d1 = data[index];

    return date - d0[timeField] > d1[timeField] - date ? d1 : d0;
  }

  return null;
}

/**
 * Create standard chart configuration with margins and dimensions
 * @param {HTMLElement} container - Chart container
 * @param {Object} customMargins - Optional custom margins
 * @returns {Object} Chart configuration
 */
export function createChartConfig(container, customMargins) {
  const margin = customMargins || { top: 20, right: 20, bottom: 70, left: 70 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = (container.clientHeight || 500) - margin.top - margin.bottom;

  return { margin, width, height };
}

/**
 * Create invisible overlay for mouse interaction
 * @param {d3.Selection} svg - SVG element
 * @param {Object} config - Chart configuration
 * @returns {d3.Selection} Overlay element
 */
export function createInteractionOverlay(svg, config) {
  return svg
    .append("rect")
    .attr("class", "overlay")
    .attr("width", config.width)
    .attr("height", config.height)
    .style("fill", "none")
    .style("pointer-events", "all");
}

/**
 * Create highlight circle for active point
 * @param {d3.Selection} svg - SVG element
 * @param {number} radius - Circle radius
 * @returns {d3.Selection} Highlight circle element
 */
export function createHighlightCircle(svg, radius = 3) {
  return svg
    .append("circle")
    .attr("class", "highlight")
    .attr("r", radius)
    .style("fill", "none")
    .style("stroke", "#000")
    .style("stroke-width", 1)
    .style("opacity", 0);
}

/**
 * Gets the display name for a field from field metadata
 * @param {string} physicalName - The physical field name
 * @param {Array} [metadataOverride] - Optional metadata array to use instead of state.aggregationDefinition.fieldMetadata
 * @returns {string} The display name or the physical name as fallback
 */
export function getDisplayName(physicalName) {
  const fieldMetadata = state.aggregationDefinition?.fieldMetadata;

  if (Array.isArray(fieldMetadata) && fieldMetadata.length > 0) {
    const field = fieldMetadata.find((f) => f.physical_name === physicalName);
    if (field?.display_name) {
      return field.display_name;
    }
  }

  // If no match found, return the physical name
  return physicalName;
}
