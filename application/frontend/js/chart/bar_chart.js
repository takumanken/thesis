import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderBarChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";
  const dimension = state.aggregationDefinition.dimensions[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  const width = CHART_DIMENSIONS.width;
  const height = CHART_DIMENSIONS.height;
  const margin = { top: 20, right: 20, bottom: 40, left: 200 };

  // Define a fixed bar height.
  const barHeight = 25;
  const totalChartHeight = margin.top + margin.bottom + barHeight * dataset.length;

  // Create a wrapper div with fixed height and enable scrolling.
  const wrapper = document.createElement("div");
  wrapper.style.width = width + "px";
  wrapper.style.height = height + "px";
  wrapper.style.overflowY = "auto";
  container.appendChild(wrapper);

  // Append an SVG with the full chart height.
  const svg = d3.select(wrapper).append("svg").attr("width", width).attr("height", totalChartHeight);

  // X scale based on the measure values.
  const xMax = d3.max(dataset, (d) => d[measure]);
  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([margin.left, width - margin.right])
    .nice();

  // Y scale for all bars.
  const y = d3
    .scaleBand()
    .domain(d3.range(dataset.length))
    .range([margin.top, totalChartHeight - margin.bottom])
    .padding(0.1);

  // Draw the bars.
  svg
    .selectAll("rect")
    .data(dataset)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d, i) => y(i))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "steelblue");

  // Append x-axis at the bottom of the full chart.
  svg
    .append("g")
    .attr("transform", `translate(0, ${totalChartHeight - margin.bottom})`)
    .call(d3.axisBottom(x));

  // Append y-axis on the left.
  svg
    .append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(
      d3
        .axisLeft(y)
        .tickFormat((d, i) => dataset[i][dimension])
        .tickSize(0)
    );
}

export default renderBarChart;
