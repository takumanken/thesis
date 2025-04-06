import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderLineChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";
  const timeDimension = state.aggregationDefinition.time_dimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  const categoricalDimension = state.aggregationDefinition.categorical_dimension?.[0] || null;

  const parseTime = d3.timeParse("%Y-%m-%d");
  const data = dataset.map((d) => ({ ...d, parsedTime: parseTime(d[timeDimension]) }));

  const margin = { top: 20, right: 20, bottom: 70, left: 70 };
  const width = CHART_DIMENSIONS.width - margin.left - margin.right;
  const height = CHART_DIMENSIONS.height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.parsedTime))
    .range([0, width]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[measure])])
    .range([height, 0]);
  const lineGenerator = d3
    .line()
    .x((d) => x(d.parsedTime))
    .y((d) => y(d[measure]));

  if (categoricalDimension) {
    const groupedData = d3.group(data, (d) => d[categoricalDimension]);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(Array.from(groupedData.keys()));
    groupedData.forEach((values, key) => {
      svg
        .append("path")
        .datum(values)
        .attr("fill", "none")
        .attr("stroke", color(key))
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);
    });
    const legend = svg
      .selectAll(".legend")
      .data(Array.from(groupedData.keys()))
      .enter()
      .append("g")
      .attr("class", "legend")
      .attr("transform", (d, i) => `translate(0,${i * 20})`);
    legend
      .append("rect")
      .attr("x", width - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", color);
    legend
      .append("text")
      .attr("x", width - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text((d) => d);
  } else {
    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", lineGenerator);
  }

  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d")))
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y));
}

export default renderLineChart;
