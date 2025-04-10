import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { createLegend } from "./utils/legendUtil.js";

function renderStackedBarChart(container, isPercentage = false) {
  // Setup UI and extract data
  setupUI(container);

  // Prepare data for visualization
  const { groupKey, stackKey, measure, stackData, sortedGroups, sortedStacks } = prepareData(container, isPercentage);

  // Create color scale
  const color = d3.scaleOrdinal().domain(sortedStacks).range(d3.schemeCategory10);

  // Create legend and get chart area
  const { chartArea } = createLegend(container, sortedStacks, color);

  // Create chart container and elements
  const { svg, xAxisSvg, config } = setupChartElements(chartArea, sortedGroups);

  // Create scales and draw chart
  const { x, y } = createScales(sortedGroups, stackData, config, isPercentage);

  // Draw chart
  drawChart(svg, xAxisSvg, x, y, stackData, sortedStacks, config, groupKey, stackKey, measure, isPercentage, color);
}

// Setup UI elements like swap button
function setupUI(container) {
  // Initialize swap flag
  container.swapDimensions = container.swapDimensions || false;
  container.innerHTML = "";

  // Create swap button
  const swapBtn = document.createElement("button");
  swapBtn.textContent = "Swap Dimensions";
  swapBtn.style.marginBottom = "10px";
  swapBtn.addEventListener("click", () => {
    container.swapDimensions = !container.swapDimensions;
    renderStackedBarChart(container, state.chartType === "stacked_bar_chart_100");
  });
  container.appendChild(swapBtn);
}

// Process data for visualization
function prepareData(container, isPercentage) {
  const dataset = state.dataset;

  // Get dimensions (apply swap if needed)
  let [groupKey, stackKey] = state.aggregationDefinition.dimensions;
  if (container.swapDimensions) {
    [groupKey, stackKey] = [stackKey, groupKey];
  }
  const measure = state.aggregationDefinition.measures[0].alias;

  // Get unique values for each dimension
  const uniqueGroups = [...new Set(dataset.map((d) => d[groupKey]))];
  const uniqueStacks = [...new Set(dataset.map((d) => d[stackKey]))];

  // Sort groups by total measure value
  const groupTotals = {};
  uniqueGroups.forEach((group) => {
    groupTotals[group] = dataset.filter((d) => d[groupKey] === group).reduce((sum, d) => sum + (d[measure] || 0), 0);
  });

  const sortedGroups = uniqueGroups.sort((a, b) => groupTotals[b] - groupTotals[a]);
  const sortedStacks = uniqueStacks;

  // Transform data for D3 stack layout
  const stackData = sortedGroups.map((group) => {
    // Create object with group as key
    const obj = { [groupKey]: group };

    // Add measure values for each stack
    sortedStacks.forEach((stack) => {
      const match = dataset.find((d) => d[groupKey] === group && d[stackKey] === stack);
      obj[stack] = match ? match[measure] : 0;
    });

    // For 100% charts, calculate percentages
    if (isPercentage) {
      const total = sortedStacks.reduce((sum, key) => sum + obj[key], 0);
      if (total > 0) {
        sortedStacks.forEach((key) => {
          obj[key + "_original"] = obj[key];
          obj[key] = (obj[key] / total) * 100;
        });
        obj._total = total;
      }
    }

    return obj;
  });

  return { groupKey, stackKey, measure, stackData, sortedGroups, sortedStacks };
}

// Setup chart structure
function setupChartElements(container, sortedGroups) {
  // Use 100% of the provided container (which is already sized to 80%)
  const width = CHART_DIMENSIONS.width * 0.8;
  const height = CHART_DIMENSIONS.height;
  const margin = { top: 40, right: 20, bottom: 60, left: 200 };

  // Calculate full chart height based on number of groups
  const barHeight = 30;
  const groupPadding = 10;
  const fullChartHeight = margin.top + margin.bottom + sortedGroups.length * (barHeight + groupPadding);

  // Create container elements
  const chartContainer = document.createElement("div");
  chartContainer.style.position = "relative";
  chartContainer.style.width = "100%";
  chartContainer.style.height = height + "px";
  container.appendChild(chartContainer);

  // Fixed x-axis container
  const xAxisDiv = document.createElement("div");
  xAxisDiv.style.position = "absolute";
  xAxisDiv.style.top = "0";
  xAxisDiv.style.width = "100%";
  xAxisDiv.style.height = margin.top + "px";
  chartContainer.appendChild(xAxisDiv);

  // Scrollable chart area
  const scrollDiv = document.createElement("div");
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = margin.top + "px";
  scrollDiv.style.width = "100%";
  scrollDiv.style.height = height - margin.top + "px";
  scrollDiv.style.overflowY = "auto";
  chartContainer.appendChild(scrollDiv);

  // Create SVGs
  const svg = d3.select(scrollDiv).append("svg").attr("width", width).attr("height", fullChartHeight);

  const xAxisSvg = d3.select(xAxisDiv).append("svg").attr("width", width).attr("height", margin.top);

  const config = { width, height, margin, fullChartHeight };
  return { svg, xAxisSvg, config };
}

// Create scales based on data
function createScales(sortedGroups, stackData, config, isPercentage) {
  // Y scale for groups
  const y = d3
    .scaleBand()
    .domain(sortedGroups)
    .range([0, config.fullChartHeight - config.margin.top - config.margin.bottom])
    .padding(0.1);

  // X scale based on measure values
  const xMax = isPercentage
    ? 100
    : d3.max(stackData, (d) => {
        return d3.sum(
          Object.entries(d)
            .filter(([key]) => key !== Object.keys(d)[0])
            .map(([_, val]) => val || 0)
        );
      });

  const x = d3
    .scaleLinear()
    .domain([0, xMax])
    .range([config.margin.left, config.width - config.margin.right])
    .nice();

  return { x, y };
}

// Draw the chart with all elements
function drawChart(
  svg,
  xAxisSvg,
  x,
  y,
  stackData,
  sortedStacks,
  config,
  groupKey,
  stackKey,
  measure,
  isPercentage,
  color
) {
  // Create stack generator
  const stack = d3.stack().keys(sortedStacks).order(d3.stackOrderNone).offset(d3.stackOffsetNone);

  const stackedData = stack(stackData);

  // Create tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "d3-tooltip")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "1px solid #ddd")
    .style("border-radius", "5px")
    .style("padding", "10px")
    .style("opacity", 0);

  // Draw axes
  svg.append("g").attr("class", "y-axis").attr("transform", `translate(${config.margin.left},0)`).call(d3.axisLeft(y));

  xAxisSvg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${config.margin.top})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickFormat((d) => (isPercentage ? d + "%" : d))
    );

  // Draw bars
  svg
    .append("g")
    .selectAll("g")
    .data(stackedData)
    .join("g")
    .attr("fill", (d) => color(d.key))
    .selectAll("rect")
    .data((d) => d)
    .join("rect")
    .attr("y", (d) => y(d.data[groupKey]))
    .attr("x", (d) => x(d[0]))
    .attr("width", (d) => x(d[1]) - x(d[0]))
    .attr("height", y.bandwidth())
    .on("mouseover", function (event, d) {
      const stackValue = d3.select(this.parentNode).datum().key;
      const groupValue = d.data[groupKey];
      const value = isPercentage ? d.data[stackValue + "_original"] : d.data[stackValue];
      const total = d.data._total || d3.sum(sortedStacks, (s) => d.data[s] || 0);
      const pct = isPercentage ? d.data[stackValue] : (value / total) * 100;

      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip
        .html(
          `
        <strong>${groupKey}:</strong> ${groupValue}<br>
        <strong>${stackKey}:</strong> ${stackValue}<br>
        <strong>${measure}:</strong> ${value.toLocaleString()}<br>
        <strong>Percentage:</strong> ${pct.toFixed(1)}%
      `
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
}

// Export the main rendering function
export default function (container) {
  const is100Percent = state.chartType === "stacked_bar_chart_100";
  renderStackedBarChart(container, is100Percent);
}
