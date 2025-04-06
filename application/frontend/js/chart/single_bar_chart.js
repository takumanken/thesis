import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderBarChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";
  const dimension = state.aggregationDefinition.dimensions[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  const width = CHART_DIMENSIONS.width;
  const totalHeight = CHART_DIMENSIONS.height;
  // Reserve top margin for fixed x-axis.
  const margin = { top: 40, right: 20, bottom: 20, left: 200 };

  // Fixed bar height.
  const barHeight = 25;
  const fullChartHeight = margin.top + margin.bottom + barHeight * dataset.length; // total height needed for bars

  // Create a container div to hold both fixed x-axis and scrollable chart.
  const chartContainer = document.createElement("div");
  chartContainer.style.position = "relative";
  chartContainer.style.width = width + "px";
  chartContainer.style.height = totalHeight + "px";
  container.appendChild(chartContainer);

  // Create a fixed div for the x-axis.
  const xAxisDiv = document.createElement("div");
  xAxisDiv.style.position = "absolute";
  xAxisDiv.style.top = "0px";
  xAxisDiv.style.left = "0px";
  xAxisDiv.style.width = "100%";
  xAxisDiv.style.height = margin.top + "px";
  chartContainer.appendChild(xAxisDiv);

  // Create a scrollable container for the bars and y-axis.
  const scrollDiv = document.createElement("div");
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = margin.top + "px";
  scrollDiv.style.left = "0px";
  scrollDiv.style.width = "100%";
  scrollDiv.style.height = totalHeight - margin.top + "px";
  scrollDiv.style.overflowY = "auto";
  chartContainer.appendChild(scrollDiv);

  // Append an SVG to the scroll div for bars and y-axis.
  const svg = d3
    .select(scrollDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", fullChartHeight - margin.top);

  // X scale based on the measure values.
  const xMax = d3.max(dataset, (d) => d[measure]);
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([margin.left, width - margin.right])
    .nice();

  // Y scale for the bars.
  const y = d3
    .scaleBand()
    .domain(d3.range(dataset.length))
    .range([0, fullChartHeight - margin.top - margin.bottom])
    .padding(0.1);

  // Draw the bars in the scrollable SVG.
  svg
    .selectAll("rect")
    .data(dataset)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d, i) => y(i))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "steelblue");

  // Add labels to each bar positioned to the right.
  svg
    .selectAll("text.bar-label")
    .data(dataset)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(d[measure]) + 5) // position label to the right of the bar
    .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .attr("fill", "black")
    .text((d) => d[measure]);

  // Append y-axis in the scrollable SVG.
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .tickFormat((d, i) => dataset[i][dimension])
        .tickSize(0)
    );

  // Create an SVG in the fixed x-axis div.
  const xAxisSvg = d3.select(xAxisDiv).append("svg").attr("width", width).attr("height", margin.top);

  // Append the x-axis at the fixed position.
  xAxisSvg
    .append("g")
    .attr("transform", `translate(0,${margin.top - 1})`)
    .call(d3.axisTop(x));
}

export default renderBarChart;
