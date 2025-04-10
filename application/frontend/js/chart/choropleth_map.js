import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js"; // Import the styles

async function renderChoroplethMap(container) {
  container.innerHTML = "";

  const { geoDimension, measure } = extractDimensions();
  const dataset = state.dataset;

  // Set up dimensions
  const width = CHART_DIMENSIONS.width;
  const height = CHART_DIMENSIONS.height;
  const margin = { top: 30, right: 80, bottom: 30, left: 30 };

  // Create SVG
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  // Create tooltip using shared style
  const tooltip = chartStyles.createTooltip("body");

  // Load GeoJSON data
  const geoData = await loadGeoData(geoDimension);

  // Create color scale
  const colorScale = d3
    .scaleQuantize()
    .domain([0, d3.max(dataset, (d) => d[measure])])
    .range(d3.schemeBlues[9]);

  // Set up projection and path generator
  const projection = d3
    .geoMercator()
    .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], geoData);

  const path = d3.geoPath().projection(projection);

  // Create map container
  const mapG = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Create map features
  mapG
    .selectAll("path")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", (d) => {
      const regionData = dataset.find((item) => item[geoDimension] === d.properties.name);
      return regionData ? colorScale(regionData[measure]) : "#ccc";
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .on("mouseover", function (event, d) {
      const regionData = dataset.find((item) => item[geoDimension] === d.properties.name);
      const value = regionData ? regionData[measure] : "No data";

      d3.select(this).attr("stroke", "#000").attr("stroke-width", 1);

      chartStyles.showTooltip(
        tooltip,
        event,
        `
        <strong>${geoDimension}:</strong> ${d.properties.name}<br>
        <strong>${measure}:</strong> ${value.toLocaleString()}
        `
      );
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);

      chartStyles.hideTooltip(tooltip);
    });

  // Add color legend
  addColorLegend(svg, colorScale, width, margin);
}

function addColorLegend(svg, colorScale, width, margin) {
  // Similar to heatmap legend but using the quantized scale
  const legendWidth = 20;
  const legendHeight = 200;

  const legend = svg.append("g").attr("transform", `translate(${width - margin.right + 30}, ${margin.top})`);

  // Get scale steps
  const domain = colorScale.domain();
  const range = colorScale.range();
  const step = (domain[1] - domain[0]) / range.length;

  // Add color rectangles
  range.forEach((color, i) => {
    legend
      .append("rect")
      .attr("y", i * (legendHeight / range.length))
      .attr("width", legendWidth)
      .attr("height", legendHeight / range.length)
      .style("fill", color)
      .style("stroke", "#fff")
      .style("stroke-width", 0.5);

    // Add value label
    const value = domain[0] + i * step;
    legend
      .append("text")
      .attr("x", legendWidth + 5)
      .attr("y", i * (legendHeight / range.length) + legendHeight / range.length / 2)
      .attr("dy", "0.35em")
      .style("font-family", chartStyles.fontFamily)
      .style("font-size", chartStyles.fontSize.tick)
      .text(Math.round(value).toLocaleString());
  });

  // Add one more value for the top of the scale
  legend
    .append("text")
    .attr("x", legendWidth + 5)
    .attr("y", legendHeight)
    .attr("dy", "0.35em")
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.tick)
    .text(Math.round(domain[1]).toLocaleString());

  // Add legend title
  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -10)
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.axisLabel)
    .text(state.aggregationDefinition.measures[0].alias);
}

export default renderChoroplethMap;
