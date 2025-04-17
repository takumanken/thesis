/**
 * Chart style definitions and utility functions
 */
export const chartStyles = {
  //-------------------------------------------------------------------------
  // STYLE CONSTANTS
  //-------------------------------------------------------------------------

  // Font settings
  fontFamily: "Noto Sans, sans-serif",
  fontSize: {
    axisLabel: "12px",
    tickLabel: "11px",
    title: "16px",
    subtitle: "13px",
  },

  // Color settings
  colors: {
    text: "#333",
    axisLine: "#ddd",
    gridLine: "#ddd",
    background: "#ffffff",
    alternateBackground: "#f8f8f8",
  },

  // Chart dimensions
  barChart: {
    bar: {
      height: 25,
      padding: 0.1,
      cornerRadius: 2,
    },
    margin: {
      top: 40,
      right: 20,
      bottom: 20,
      left: 200,
    },
    maxHeight: 500,
    valueGap: 5,
  },

  //-------------------------------------------------------------------------
  // AXIS STYLING
  //-------------------------------------------------------------------------

  /**
   * Apply consistent axis styling to a D3 selection
   * @param {Selection} axisGroup - D3 selection of axis group
   * @param {Object} options - Styling options
   * @returns {Selection} - The styled axis group
   */
  applyAxisStyles(axisGroup, options = {}) {
    const config = {
      hideAxisLine: options.hideAxisLine || false,
      hideTickLines: options.hideTickLines || false,
      textAnchor: options.textAnchor || null,
    };

    // Style axis line
    if (config.hideAxisLine) {
      axisGroup.select(".domain").style("display", "none");
    } else {
      axisGroup
        .select(".domain")
        .attr("stroke", this.colors.axisLine)
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");
    }

    // Style tick lines
    if (config.hideTickLines) {
      axisGroup.selectAll(".tick line").style("display", "none");
    } else {
      axisGroup
        .selectAll(".tick line")
        .attr("stroke", this.colors.gridLine)
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");
    }

    // Style tick text
    const textElements = axisGroup
      .selectAll(".tick text")
      .attr("fill", this.colors.text)
      .style("font-family", this.fontFamily)
      .style("font-size", this.fontSize.tickLabel);

    if (config.textAnchor) {
      textElements.attr("text-anchor", config.textAnchor);
    }

    return axisGroup;
  },

  /**
   * Draw a grid line with consistent styling
   * @param {Selection} svg - SVG element to append line to
   * @param {number} x1 - Starting x coordinate
   * @param {number} x2 - Ending x coordinate
   * @param {number} y1 - Starting y coordinate
   * @param {number} y2 - Ending y coordinate
   * @returns {Selection} - The created line element
   */
  drawGridLine(svg, x1, x2, y1, y2) {
    return svg
      .append("line")
      .attr("x1", x1)
      .attr("x2", x2)
      .attr("y1", y1)
      .attr("y2", y2)
      .attr("stroke", this.colors.gridLine)
      .attr("stroke-width", 1)
      .attr("shape-rendering", "crispEdges");
  },

  /**
   * Get appropriate chart margins based on chart type
   * @param {string} chartType - Type of chart
   * @returns {Object} - Margin configuration
   */
  getChartMargins(chartType) {
    switch (chartType) {
      case "grouped_bar_chart":
      case "stacked_bar_chart":
        return { ...this.barChart.margin, left: 150 };

      case "nested_bar_chart":
        return { top: 40, right: 120, bottom: 30, left: 30 };

      case "horizontal_bar_chart":
        return this.barChart.margin;

      case "vertical_bar_chart":
        return { top: 20, right: 20, bottom: 80, left: 60 };

      default:
        return this.barChart.margin;
    }
  },

  //-------------------------------------------------------------------------
  // TOOLTIP SYSTEM
  //-------------------------------------------------------------------------

  /**
   * Creates a tooltip element
   * @returns {Selection} D3 selection of tooltip div
   */
  createTooltip: function () {
    return d3
      .select("body")
      .append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "3px")
      .style("padding", "8px")
      .style("font-family", this.fontFamily)
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000)
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");
  },

  tooltip: {
    /**
     * Display tooltip with preformatted HTML content
     * @param {Selection} tooltip - The tooltip element
     * @param {Event} event - Mouse event
     * @param {string} content - HTML content
     */
    show: function (tooltip, event, content) {
      tooltip
        .html(content)
        .style("visibility", "visible")
        .style("opacity", 0.9)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    },

    /**
     * Hide the tooltip
     * @param {Selection} tooltip - The tooltip element
     */
    hide: function (tooltip) {
      tooltip.style("visibility", "hidden").style("opacity", 0);
    },

    /**
     * Display tooltip for structured data
     * @param {Selection} tooltip - The tooltip element
     * @param {Event} event - Mouse event
     * @param {Object} data - Data values to display
     * @param {Object} config - Display configuration
     */
    showForData: function (tooltip, event, data, config) {
      const content = this.formatContent(data, config);
      this.show(tooltip, event, content);
    },

    /**
     * Format data into tooltip HTML content
     * @param {Object} data - Data values to display
     * @param {Object} config - Configuration for display
     * @param {Array} config.dimensions - Dimension fields to show
     * @param {Array} config.measures - Measure fields to show
     * @param {Object} config.labels - Custom field labels
     * @param {Object} config.formatters - Custom value formatters
     * @returns {string} HTML content
     */
    formatContent: function (data, config) {
      const { dimensions = [], measures = [], labels = {}, formatters = {} } = config;
      const chartStyles = this.parent; // Reference to parent chartStyles object

      // Default formatter
      const defaultFormatter = (val) => (typeof val === "number" ? chartStyles.formatValue(val) : val || "N/A");

      // Build HTML content
      let content = "";

      // Add dimensions
      dimensions.forEach((dim) => {
        if (data[dim] !== undefined) {
          const label = labels[dim] || dim;
          const formatter = formatters[dim] || defaultFormatter;
          content += `<strong>${label}:</strong> ${formatter(data[dim])}<br>`;
        }
      });

      // Add measures
      measures.forEach((measure) => {
        if (data[measure] !== undefined) {
          const label = labels[measure] || measure;
          const formatter = formatters[measure] || defaultFormatter;
          content += `<strong>${label}:</strong> ${formatter(data[measure])}<br>`;
        }
      });

      return content;
    },
  },

  //-------------------------------------------------------------------------
  // COLOR UTILITIES
  //-------------------------------------------------------------------------

  /**
   * Get contrasting text color (black or white) based on background color
   * @param {string|Object} backgroundColor - Color in various formats
   * @returns {string} - "#333333" for light backgrounds, "#ffffff" for dark backgrounds
   */
  getContrastingTextColor(backgroundColor) {
    // Handle null/undefined
    if (!backgroundColor) return "#333333";

    const rgb = this._extractRGB(backgroundColor);
    if (!rgb) return "#333333";

    // Calculate perceived brightness using W3C formula
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 125 ? "#333333" : "#ffffff";
  },

  /**
   * Extract RGB values from various color formats
   * @private
   * @param {string|Object} color - Color in various formats
   * @returns {Object|null} - Object with r,g,b properties or null if extraction failed
   */
  _extractRGB(color) {
    // Handle object formats
    if (typeof color === "object") {
      // For d3.color objects with rgb() method
      if (color.rgb) {
        const rgb = color.rgb();
        return { r: rgb.r, g: rgb.g, b: rgb.b };
      }
      // For objects with r,g,b properties
      else if ("r" in color && "g" in color && "b" in color) {
        return { r: color.r, g: color.g, b: color.b };
      }
    }
    // Handle string formats
    else if (typeof color === "string") {
      // Hex format
      if (color.startsWith("#")) {
        return {
          r: parseInt(color.slice(1, 3), 16),
          g: parseInt(color.slice(3, 5), 16),
          b: parseInt(color.slice(5, 7), 16),
        };
      }
      // RGB/RGBA format
      else if (color.startsWith("rgb")) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (match) {
          return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3]),
          };
        }
      }
    }

    return null;
  },
};
