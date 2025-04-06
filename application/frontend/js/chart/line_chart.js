import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderLineChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";

  // Get the primary time dimension.
  const timeDimension = state.aggregationDefinition.time_dimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Look for an additional grouping dimension (either categorical or geo).
  let groupDimension = null;
  if (
    state.aggregationDefinition.categorical_dimension &&
    state.aggregationDefinition.categorical_dimension.length > 0
  ) {
    groupDimension = state.aggregationDefinition.categorical_dimension[0];
  } else if (state.aggregationDefinition.geo_dimension && state.aggregationDefinition.geo_dimension.length > 0) {
    groupDimension = state.aggregationDefinition.geo_dimension[0];
  }

  const parseTime = d3.timeParse("%Y-%m-%d");
  // Parse time and filter invalid records.
  const data = dataset.map((d) => ({ ...d, parsedTime: parseTime(d[timeDimension]) })).filter((d) => d.parsedTime);

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

  // X scale uses the full time extent.
  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.parsedTime))
    .range([0, width]);

  // Y scale for the measure values.
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[measure])])
    .range([height, 0]);

  // Line generator function.
  const lineGenerator = d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => x(d.parsedTime))
    .y((d) => y(d[measure]));

  if (groupDimension) {
    // Group data according to the additional dimension.
    const groupedData = d3.group(data, (d) => d[groupDimension]);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(Array.from(groupedData.keys()));

    // For each group, sort the values by parsedTime and draw a line.
    groupedData.forEach((values, key) => {
      const validValues = values.sort((a, b) => a.parsedTime - b.parsedTime);
      svg
        .append("path")
        .datum(validValues)
        .attr("fill", "none")
        .attr("stroke", color(key))
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);
    });

    // Create legend for groups.
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
    // When there is only a time dimension, sort data globally and draw a single line.
    svg
      .append("path")
      .datum(data.sort((a, b) => a.parsedTime - b.parsedTime))
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2)
      .attr("d", lineGenerator);
  }

  // Append x-axis.
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d")))
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // Append y-axis.
  svg.append("g").call(d3.axisLeft(y));
}

export default renderLineChart;
