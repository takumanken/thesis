import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js"; // Import the styles

function renderHeatMap(container) {
  container.innerHTML = "";

  const { xDimension, yDimension, measure } = extractDimensions();
  const dataset = state.dataset;

  const { margin, width, height, svg } = setupChart(container);
  const { x, y, colorScale, xLabels, yLabels } = createScales(dataset, xDimension, yDimension, measure, width, height);

  // Create tooltip using shared style
  const tooltip = chartStyles.createTooltip("body");

  // Draw cells
  svg
    .selectAll()
    .data(dataset)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d[xDimension]))
    .attr("y", (d) => y(d[yDimension]))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .style("fill", (d) => colorScale(d[measure]))
    .on("mouseover", function (event, d) {
      chartStyles.showTooltip(
        tooltip,
        event,
        `
        <strong>${xDimension}:</strong> ${d[xDimension]}<br>
        <strong>${yDimension}:</strong> ${d[yDimension]}<br>
        <strong>${measure}:</strong> ${d[measure].toLocaleString()}
        `
      );
    })
    .on("mouseout", () => chartStyles.hideTooltip(tooltip));

  // Add axes with consistent styling
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .call((g) => chartStyles.applyAxisStyles(g));

  svg
    .append("g")
    .call(d3.axisLeft(y))
    .call((g) => chartStyles.applyAxisStyles(g));

  // Add color scale legend if needed
  addColorLegend(svg, colorScale, width, margin);
}

function addColorLegend(svg, colorScale, width, margin) {
  const legendWidth = 20;
  const legendHeight = 200;

  // Create gradient for the legend
  const defs = svg.append("defs");
  const linearGradient = defs
    .append("linearGradient")
    .attr("id", "color-legend-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "0%")
    .attr("y2", "100%");

  // Add color stops
  const domain = colorScale.domain();
  const min = domain[0];
  const max = domain[domain.length - 1];
  const range = colorScale.range();

  range.forEach((color, i) => {
    const offset = `${(i * 100) / (range.length - 1)}%`;
    linearGradient.append("stop").attr("offset", offset).attr("stop-color", color);
  });

  // Create the legend rectangle
  const legend = svg.append("g").attr("transform", `translate(${width - margin.right + 30}, ${margin.top})`);

  legend
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#color-legend-gradient)");

  // Add scale ticks
  const scale = d3.scaleLinear().domain([max, min]).range([0, legendHeight]);

  const axis = d3.axisRight(scale).ticks(5);

  legend
    .append("g")
    .attr("transform", `translate(${legendWidth}, 0)`)
    .call(axis)
    .call((g) => chartStyles.applyAxisStyles(g));

  // Add legend title
  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -10)
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel)
    .text("Value");
}

export default renderHeatMap;
export { renderHeatMap as renderHeatmap };
