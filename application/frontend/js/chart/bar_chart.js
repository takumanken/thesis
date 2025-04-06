import { state } from "../state.js";
import { CHART_DIMENSIONS, BAR_CHART_PAGE_SIZE } from "../constants.js";

function renderBarChart(container) {
  const dataset = state.dataset;
  container.innerHTML = "";
  const dimension = state.aggregationDefinition.dimensions[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  const pageSize = BAR_CHART_PAGE_SIZE;
  const page = state.barChartPage || 0;
  const totalPages = Math.ceil(dataset.length / pageSize);
  const pageData = dataset.slice(page * pageSize, (page + 1) * pageSize);

  const width = CHART_DIMENSIONS.width;
  const height = CHART_DIMENSIONS.height;
  const margin = { top: 20, right: 20, bottom: 20, left: 200 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(pageData, (d) => d[measure])])
    .nice()
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleBand()
    .domain(d3.range(pageData.length))
    .range([margin.top, height - margin.bottom])
    .padding(0.1);

  svg
    .selectAll("rect")
    .data(pageData)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d, i) => y(i))
    .attr("width", (d) => x(d[measure]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", "steelblue");

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));
  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .tickFormat((d, i) => pageData[i][dimension])
        .tickSize(0)
    );

  // Pagination controls.
  const paginationDiv = document.createElement("div");
  paginationDiv.style.marginTop = "5px";

  const prevButton = document.createElement("button");
  prevButton.textContent = "Previous";
  prevButton.disabled = page <= 0;
  prevButton.addEventListener("click", () => {
    state.barChartPage = page - 1;
    renderBarChart(container);
  });

  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.disabled = page >= totalPages - 1;
  nextButton.addEventListener("click", () => {
    state.barChartPage = page + 1;
    renderBarChart(container);
  });

  const pageInfo = document.createElement("span");
  pageInfo.textContent = ` Page ${page + 1} of ${totalPages} `;

  paginationDiv.append(prevButton, pageInfo, nextButton);
  container.appendChild(paginationDiv);
}

export default renderBarChart;
