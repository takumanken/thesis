/**
 * Shared styling for all chart visualizations
 */
export const chartStyles = {
  // Font settings
  fontFamily: "Noto Sans, sans-serif",
  fontSize: {
    title: "16px",
    axisLabel: "12px",
    tickLabel: "11px",
    subtitle: "13px",
  },

  // Colors
  colors: d3.schemeCategory10,

  // Tooltip creation
  createTooltip(container = "body") {
    return d3.select(container).append("div").attr("class", "tooltip").call(this.applyTooltipStyles);
  },

  // Show tooltip with content
  showTooltip(tooltip, event, content) {
    tooltip
      .html(content)
      .style("left", event.pageX + 12 + "px")
      .style("top", event.pageY - 28 + "px")
      .style("opacity", 0.95);
  },

  // Hide tooltip
  hideTooltip(tooltip) {
    tooltip.style("opacity", 0);
  },

  // Tooltip styling
  applyTooltipStyles(tooltip) {
    return tooltip
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "white")
      .style("color", "#333")
      .style("font-family", chartStyles.fontFamily)
      .style("font-size", chartStyles.fontSize.tooltip)
      .style("padding", "8px 10px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("z-index", "100")
      .style("opacity", "0");
  },

  // Apply axis styles
  applyAxisStyles(selection) {
    selection.selectAll(".domain").style("stroke", "#888");
    selection.selectAll(".tick line").style("stroke", "#d1d1d1");
    selection
      .selectAll(".tick text")
      .style("fill", "#333")
      .style("font-size", this.fontSize.tickLabel)
      .style("font-family", this.fontFamily);
    return selection;
  },

  // Legend styling
  applyLegendStyles(legend) {
    legend
      .selectAll("text")
      .style("font-family", this.fontFamily)
      .style("font-size", this.fontSize.legend)
      .style("color", "#333");

    return legend;
  },

  // Create and return a consistent color scale
  getColorScale(domain) {
    return d3.scaleOrdinal(this.colors).domain(domain);
  },

  /**
   * Determines a contrasting text color for better readability
   * @param {string|object} backgroundColor - Background color (string or d3 color object)
   * @param {number} opacity - Opacity for the text color (0-1)
   * @returns {string} Contrasting color as rgba string
   */
  getContrastingTextColor(backgroundColor, opacity = 1) {
    const color = typeof backgroundColor === "string" ? d3.color(backgroundColor) : backgroundColor;
    if (!color) return `rgba(0, 0, 0, ${opacity})`;

    const r = color.r;
    const g = color.g;
    const b = color.b;

    // Use WCAG luminance formula for better contrast perception
    // Formula: 0.2126*R + 0.7152*G + 0.0722*B (where RGB are normalized)
    const normalizedR = r / 255;
    const normalizedG = g / 255;
    const normalizedB = b / 255;

    // Calculate relative luminance using the WCAG formula
    const wcagLuminance = 0.2126 * normalizedR + 0.7152 * normalizedG + 0.0722 * normalizedB;

    // Use the WCAG luminance threshold of 0.5 for contrast
    return wcagLuminance < 0.5 ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
  },

  // Add bar chart specific settings
  barChart: {
    bar: {
      height: 35,
      padding: 0.5,
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
   * Get appropriate chart margins based on chart type
   * @param {string} chartType - Type of chart
   * @returns {Object} Margin object
   */
  getChartMargins(chartType) {
    switch (chartType) {
      case "grouped_bar_chart":
      case "stacked_bar_chart":
        return { ...this.barChart.margin, left: 150 }; // Slightly narrower left margin

      case "horizontal_bar_chart":
        return this.barChart.margin;

      case "vertical_bar_chart":
        return { top: 20, right: 20, bottom: 80, left: 60 }; // Different margins for vertical orientation

      default:
        return this.barChart.margin;
    }
  },
};
