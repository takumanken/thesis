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
   */
  applyAxisStyles: function (axisGroup, options = {}) {
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
   */
  drawGridLine: function (svg, x1, x2, y1, y2) {
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
   */
  getChartMargins: function (chartType) {
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
  // TOOLTIPS
  //-------------------------------------------------------------------------

  /**
   * Creates a tooltip element
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

  /**
   * Show tooltip with content at a specific position
   */
  showTooltip: function (tooltip, event, content) {
    tooltip
      .html(content)
      .style("visibility", "visible")
      .style("opacity", 0.9)
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  },

  /**
   * Hide tooltip
   */
  hideTooltip: function (tooltip) {
    tooltip.style("visibility", "hidden").style("opacity", 0);
  },

  //-------------------------------------------------------------------------
  // COLOR UTILITIES
  //-------------------------------------------------------------------------

  /**
   * Get contrasting text color (black or white) based on background color
   * @param {string|Object} backgroundColor - Color in various formats
   * @returns {string} - "#333333" for light backgrounds, "#ffffff" for dark backgrounds
   */
  getContrastingTextColor: function (backgroundColor) {
    // Handle null/undefined
    if (!backgroundColor) {
      return "#333333";
    }

    let r, g, b;

    // Handle different color formats
    if (typeof backgroundColor === "object") {
      // For d3.color objects with rgb() method
      if (backgroundColor.rgb) {
        const rgb = backgroundColor.rgb();
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
      }
      // For objects with r,g,b properties
      else if ("r" in backgroundColor && "g" in backgroundColor && "b" in backgroundColor) {
        r = backgroundColor.r;
        g = backgroundColor.g;
        b = backgroundColor.b;
      }
      // Default case if we can't extract RGB values
      else {
        return "#333333";
      }
    }
    // Handle string formats
    else if (typeof backgroundColor === "string") {
      if (backgroundColor.startsWith("#")) {
        r = parseInt(backgroundColor.slice(1, 3), 16);
        g = parseInt(backgroundColor.slice(3, 5), 16);
        b = parseInt(backgroundColor.slice(5, 7), 16);
      }
      // Handle rgb/rgba strings
      else if (backgroundColor.startsWith("rgb")) {
        const match = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
        } else {
          return "#333333";
        }
      }
      // Named colors
      else {
        return "#333333";
      }
    }
    // Unexpected input types
    else {
      return "#333333";
    }

    // Calculate perceived brightness using W3C formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 125 ? "#333333" : "#ffffff";
  },
};
