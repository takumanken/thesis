import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderGroupedBarChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";

  // Two dimensions are assumed: group (major) and subgroup (minor)
  const groupKey = state.aggregationDefinition.dimensions[0]; // e.g. "neighborhood"
  const subGroupKey = state.aggregationDefinition.dimensions[1]; // e.g. "complaint_type_large"
  const measure = state.aggregationDefinition.measures[0].alias; // e.g. "num_of_requests"

  const width = CHART_DIMENSIONS.width;
  const totalHeight = CHART_DIMENSIONS.height;
  // Reserve top margin for fixed x-axis.
  const margin = { top: 40, right: 20, bottom: 20, left: 200 };

  // Compute sorted unique groups based on total measure (desc)
  const groupSums = d3.rollup(
    dataset,
    (v) => d3.sum(v, (d) => d[measure]),
    (d) => d[groupKey]
  );
  const sortedGroups = Array.from(groupSums, ([key, sum]) => ({ key, sum }))
    .sort((a, b) => d3.descending(a.sum, b.sum))
    .map((d) => d.key);

  // Compute sorted unique subgroups based on total measure (desc) - global ordering
  const subGroupSums = d3.rollup(
    dataset,
    (v) => d3.sum(v, (d) => d[measure]),
    (d) => d[subGroupKey]
  );
  const sortedSubGroups = Array.from(subGroupSums, ([key, sum]) => ({ key, sum }))
    .sort((a, b) => d3.descending(a.sum, b.sum))
    .map((d) => d.key);

  // Outer y-scale for groups.
  const outerY = d3
    .scaleBand()
    .domain(sortedGroups)
    .range([0, totalHeight - margin.top - margin.bottom])
    .padding(0.2);

  // Inner y-scale for subgroups within each group.
  const innerY = d3.scaleBand().domain(sortedSubGroups).range([0, outerY.bandwidth()]).padding(0.1);

  // X scale based on measure values.
  const xMax = d3.max(dataset, (d) => d[measure]);
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([margin.left, width - margin.right])
    .nice();

  // Define fullChartHeight for the SVG.
  const fullChartHeight = margin.top + margin.bottom + (totalHeight - margin.top - margin.bottom);

  // Create the main container that holds both fixed x-axis and a scrollable area.
  const chartContainer = document.createElement("div");
  chartContainer.style.position = "relative";
  chartContainer.style.width = width + "px";
  chartContainer.style.height = totalHeight + "px";
  container.appendChild(chartContainer);

  // Create fixed container for the x-axis.
  const xAxisDiv = document.createElement("div");
  xAxisDiv.style.position = "absolute";
  xAxisDiv.style.top = "0px";
  xAxisDiv.style.left = "0px";
  xAxisDiv.style.width = "100%";
  xAxisDiv.style.height = margin.top + "px";
  chartContainer.appendChild(xAxisDiv);

  // Create scrollable container for the bars and y-axis.
  const scrollDiv = document.createElement("div");
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = margin.top + "px";
  scrollDiv.style.left = "0px";
  scrollDiv.style.width = "100%";
  scrollDiv.style.height = totalHeight - margin.top + "px";
  scrollDiv.style.overflowY = "auto";
  chartContainer.appendChild(scrollDiv);

  // Append an SVG to the scrollable container.
  const svg = d3
    .select(scrollDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", fullChartHeight - margin.top);

  // Define a color scale for subgroups.
  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(sortedSubGroups);

  // Create a tooltip element.
  const tooltip = d3
    .select(container)
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "#fff")
    .style("padding", "5px")
    .style("border", "1px solid #ccc")
    .style("display", "none");

  // Draw the grouped bars.
  svg
    .selectAll("rect")
    .data(dataset)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d) => outerY(d[groupKey]) + innerY(d[subGroupKey]))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", innerY.bandwidth())
    .attr("fill", (d) => color(d[subGroupKey]))
    .on("mouseover", function (event, d) {
      tooltip
        .style("display", "block")
        .html(`${groupKey}: ${d[groupKey]}<br>${subGroupKey}: ${d[subGroupKey]}<br>${measure}: ${d[measure]}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mousemove", function (event) {
      tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });

  // Append y-axis for groups (major dimension).
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(outerY).tickSize(0));

  // Append legend for subgroups (minor dimension).
  // The legend is positioned at the bottom right of the scrollable SVG.
  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", () => {
      const legendHeight = sortedSubGroups.length * 20; // row height of 20
      return `translate(${width - margin.right - 120}, ${fullChartHeight - margin.top - legendHeight - 10})`;
    });

  sortedSubGroups.forEach((d, i) => {
    const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
    legendRow.append("rect").attr("width", 18).attr("height", 18).attr("fill", color(d));
    legendRow.append("text").attr("x", -5).attr("y", 9).attr("dy", "0.35em").attr("text-anchor", "end").text(d);
  });

  // Create an SVG for the fixed x-axis.
  const xAxisSvg = d3.select(xAxisDiv).append("svg").attr("width", width).attr("height", margin.top);

  // Append the x-axis at the top.
  xAxisSvg
    .append("g")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(x));
}

export default renderGroupedBarChart;
