import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { createLegend } from "./utils/legendUtil.js";
import { chartStyles } from "./utils/chartStyles.js"; // Import the styles

function renderStackedBarChart(container, isPercentage = false) {
  // Clear main container
  container.innerHTML = "";

  // Create a dedicated controls container that won't be cleared
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "chart-controls";
  container.appendChild(controlsDiv);

  // Create flexible container for legend and chart
  const flexContainer = document.createElement("div");
  flexContainer.className = "chart-flex-container";
  container.appendChild(flexContainer);

  // Add swap button to controls div (won't be cleared later)
  addSwapButton(controlsDiv, container, isPercentage);

  // Prepare data for visualization
  const { groupKey, stackKey, measure, stackData, sortedGroups, sortedStacks } = prepareData(container, isPercentage);

  // Create color scale
  const color = d3.scaleOrdinal().domain(sortedStacks).range(d3.schemeCategory10);

  // Create legend and get chart area
  const { chartArea } = createLegend(flexContainer, sortedStacks, color);

  // Create chart container and elements
  const { svg, xAxisSvg, config } = setupChartElements(chartArea, sortedGroups);

  // Create scales and draw chart
  const { x, y } = createScales(sortedGroups, stackData, config, isPercentage);

  // Draw chart
  drawChart(svg, xAxisSvg, x, y, stackData, sortedStacks, config, groupKey, stackKey, measure, isPercentage, color);
}

// Simple function that ONLY adds the button without clearing
function addSwapButton(controlsDiv, parentContainer, isPercentage) {
  // Initialize swap flag on the main container
  parentContainer.swapDimensions = parentContainer.swapDimensions || false;

  const swapBtn = document.createElement("button");
  swapBtn.textContent = "Swap Dimensions";
  swapBtn.className = "chart-button";

  swapBtn.addEventListener("click", () => {
    parentContainer.swapDimensions = !parentContainer.swapDimensions;
    renderStackedBarChart(parentContainer, isPercentage);
  });

  controlsDiv.appendChild(swapBtn);
}

// Process data for visualization (keep this function largely the same)
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
  xAxisDiv.style.zIndex = "2"; // Ensure it's above the scroll area
  chartContainer.appendChild(xAxisDiv);

  // Scrollable chart area - ADJUST THIS LINE:
  const scrollDiv = document.createElement("div");
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = margin.top - 1 + "px"; // Move up by 1px to remove gap
  scrollDiv.style.width = "100%";
  scrollDiv.style.height = height - margin.top + "px";
  scrollDiv.style.overflowY = "auto";
  chartContainer.appendChild(scrollDiv);

  // Create SVGs
  const svg = d3.select(scrollDiv).append("svg").attr("width", width).attr("height", fullChartHeight);

  const xAxisSvg = d3
    .select(xAxisDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", margin.top + 30);

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

  // Create tooltip using the shared styles
  const tooltip = chartStyles.createTooltip("body");

  // Draw y-axis with consistent styling
  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${config.margin.left},0)`)
    .call(d3.axisLeft(y))
    .call((g) => chartStyles.applyAxisStyles(g));

  // Draw x-axis with consistent styling (matching grouped bar chart)
  xAxisSvg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${config.margin.top - 1})`) // Match grouped bar chart's positioning
    .call(
      d3
        .axisTop(x) // Use axisTop like grouped bar chart instead of axisBottom
        .ticks(5)
        .tickFormat((d) => (isPercentage ? d + "%" : d))
    )
    .call((g) => chartStyles.applyAxisStyles(g));

  // Draw bars with consistent tooltip behavior
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

      // Use the shared tooltip behavior
      chartStyles.showTooltip(
        tooltip,
        event,
        `
        <strong>${groupKey}:</strong> ${groupValue}<br>
        <strong>${stackKey}:</strong> ${stackValue}<br>
        <strong>${measure}:</strong> ${value.toLocaleString()}<br>
        <strong>Percentage:</strong> ${pct.toFixed(1)}%
      `
      );
    })
    .on("mouseout", () => chartStyles.hideTooltip(tooltip));
}

// Export the main rendering function
export default function (container) {
  const is100Percent = state.chartType === "stacked_bar_chart_100";
  renderStackedBarChart(container, is100Percent);
}
