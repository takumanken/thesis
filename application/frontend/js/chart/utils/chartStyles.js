/**
 * Shared styling for all chart visualizations
 */
export const chartStyles = {
  // Font settings
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: {
    title: "16px",
    axisLabel: "12px",
    tick: "11px",
    legend: "12px",
    tooltip: "12px",
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
      .style("font-size", this.fontSize.tick)
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
};
