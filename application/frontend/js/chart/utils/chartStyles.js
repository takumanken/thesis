/**
 * Chart style definitions and utility functions
 */
export const chartStyles = {
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

  // Bar chart settings
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

  /**
   * Apply consistent axis styling to a D3 selection
   * @param {d3.Selection} axisGroup - D3 selection containing axis elements
   * @param {Object} options - Styling options
   */
  applyAxisStyles: function (axisGroup, options = {}) {
    // Merge defaults with provided options
    const config = {
      hideAxisLine: options.hideAxisLine || false,
      hideTickLines: options.hideTickLines || false,
      textAnchor: options.textAnchor || null,
    };

    // Style the axis path (main line)
    if (config.hideAxisLine) {
      axisGroup.select(".domain").style("display", "none");
    } else {
      axisGroup
        .select(".domain")
        .attr("stroke", this.colors.axisLine)
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");
    }

    // Style the tick lines
    if (config.hideTickLines) {
      axisGroup.selectAll(".tick line").style("display", "none");
    } else {
      axisGroup
        .selectAll(".tick line")
        .attr("stroke", this.colors.gridLine)
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");
    }

    // Style the tick text
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
   * Draw a grid line
   * @param {d3.Selection} svg - SVG element
   * @param {number} x1 - Start x position
   * @param {number} x2 - End x position
   * @param {number} y1 - Start y position
   * @param {number} y2 - End y position
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
   * @param {string} chartType - Type of chart
   * @returns {Object} Margin object
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

  /**
   * Creates a tooltip element
   */
  createTooltip: function () {
    const tooltip = d3
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

    return tooltip;
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
};
