import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js";

export default function (container) {
  const is100Percent = state.chartType === "stacked_area_chart_100";
  renderStackedAreaChart(container, is100Percent);
}

function renderStackedAreaChart(container, isPercentage = false) {
  container.innerHTML = "";

  const { chartArea, legendDiv } = createLayout(container);

  const { timeDimension, categoricalDimension, measure, isNumericTime, data, timeValues, categories } =
    prepareDataAndConfig();

  const colorScale = d3.scaleOrdinal().domain(categories).range(d3.schemeCategory10);

  createLegend(legendDiv, categories, colorScale);

  const { svg, margin, width, height } = setupSvg(chartArea);
  const tooltip = createTooltip();

  const x = createXScale(timeValues, width, isNumericTime);
  const stackedData = createStackedData(categories, data, isPercentage);
  const y = createYScale(stackedData, height, isPercentage);

  drawAreas(svg, stackedData, x, y, colorScale, tooltip, {
    data,
    timeDimension,
    categoricalDimension,
    measure,
    isNumericTime,
    isPercentage,
    categories,
  });

  addAxes(svg, x, y, height, isNumericTime, isPercentage);
}

function createLayout(container) {
  const flexContainer = document.createElement("div");
  flexContainer.style.display = "flex";
  flexContainer.style.width = "100%";
  flexContainer.style.height = "100%";
  container.appendChild(flexContainer);

  const chartArea = document.createElement("div");
  chartArea.className = "chart-area";
  chartArea.style.width = "80%";
  flexContainer.appendChild(chartArea);

  const legendDiv = document.createElement("div");
  legendDiv.className = "chart-legend";
  legendDiv.style.width = "20%";
  legendDiv.style.padding = "10px";
  legendDiv.style.overflowY = "auto";
  legendDiv.style.borderLeft = "1px solid #ddd";
  flexContainer.appendChild(legendDiv);

  return { chartArea, legendDiv };
}

function prepareDataAndConfig() {
  const timeDimension = state.aggregationDefinition.timeDimension[0];
  const categoricalDimension = state.aggregationDefinition.categoricalDimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  const dataset = state.dataset;
  const isNumericTime = /_datepart$/.test(timeDimension);

  const { data, timeValues, categories } = processData(
    dataset,
    timeDimension,
    categoricalDimension,
    measure,
    isNumericTime
  );

  return {
    timeDimension,
    categoricalDimension,
    measure,
    isNumericTime,
    data,
    timeValues,
    categories,
  };
}

function processData(dataset, timeDimension, categoricalDimension, measure, isNumericTime) {
  const parseTime = d3.timeParse("%Y-%m-%d");
  const timeValueMap = new Map();
  const categorySet = new Set();
  const categoryTotals = new Map();

  dataset.forEach((d) => {
    const timeStr = d[timeDimension];
    const timeVal = isNumericTime ? +timeStr : parseTime(timeStr);
    const category = d[categoricalDimension];
    const value = +d[measure] || 0;

    if (timeVal && category) {
      timeValueMap.set(timeStr, timeVal);
      categorySet.add(category);
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + value);
    }
  });

  const timeValues = [...timeValueMap.values()].sort((a, b) => a - b);
  const categories = Array.from(categorySet).sort((a, b) => categoryTotals.get(b) - categoryTotals.get(a));

  const timeEntries = {};
  timeValues.forEach((time) => {
    const entry = { time };
    categories.forEach((cat) => {
      entry[cat] = 0;
    });
    const timeKey = isNumericTime ? time : d3.timeFormat("%Y-%m-%d")(time);
    timeEntries[timeKey] = entry;
  });

  dataset.forEach((d) => {
    const timeStr = d[timeDimension];
    const category = d[categoricalDimension];
    const value = +d[measure] || 0;

    if (timeStr && category && timeEntries[timeStr]) {
      timeEntries[timeStr][category] += value;
    }
  });

  const data = Object.values(timeEntries).sort((a, b) => a.time - b.time);

  return { data, timeValues, categories };
}

function createLegend(legendDiv, categories, colorScale) {
  [...categories].reverse().forEach((category) => {
    const itemDiv = document.createElement("div");
    itemDiv.style.display = "flex";
    itemDiv.style.alignItems = "center";
    itemDiv.style.marginBottom = "8px";

    const colorBox = document.createElement("span");
    colorBox.style.width = "15px";
    colorBox.style.height = "15px";
    colorBox.style.backgroundColor = colorScale(category);
    colorBox.style.border = "1px solid #000";
    colorBox.style.marginRight = "8px";

    const label = document.createElement("span");
    label.style.fontSize = chartStyles.fontSize.legend;
    label.style.fontFamily = chartStyles.fontFamily;
    label.style.color = "#333";
    label.textContent = category;

    itemDiv.appendChild(colorBox);
    itemDiv.appendChild(label);
    legendDiv.appendChild(itemDiv);
  });
}

function setupSvg(chartArea) {
  const margin = { top: 20, right: 20, bottom: 70, left: 70 };
  const width = CHART_DIMENSIONS.width * 0.8 - margin.left - margin.right;
  const height = CHART_DIMENSIONS.height - margin.top - margin.bottom;

  const svg = d3
    .select(chartArea)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return { svg, margin, width, height };
}

function createTooltip() {
  return d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ddd")
    .style("border-radius", "3px")
    .style("padding", "8px")
    .style("pointer-events", "none")
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", chartStyles.fontSize.tooltip);
}

function createXScale(timeValues, width, isNumericTime) {
  return isNumericTime
    ? d3.scaleLinear().domain(d3.extent(timeValues)).range([0, width]).nice()
    : d3.scaleTime().domain(d3.extent(timeValues)).range([0, width]).nice();
}

function createYScale(stackedData, height, isPercentage) {
  if (isPercentage) {
    return d3.scaleLinear().domain([0, 1]).range([height, 0]);
  } else {
    const maxY = d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1]));
    return d3
      .scaleLinear()
      .domain([0, maxY || 0])
      .range([height, 0]);
  }
}

function createStackedData(categories, data, isPercentage) {
  const stack = d3
    .stack()
    .keys(categories)
    .order(d3.stackOrderNone)
    .offset(isPercentage ? d3.stackOffsetExpand : d3.stackOffsetNone);

  const stackedData = stack(data);

  if (isPercentage) {
    data.forEach((point) => {
      const total = categories.reduce((sum, cat) => sum + point[cat], 0);
      point._total = total;

      if (total > 0) {
        categories.forEach((cat) => {
          point[cat + "_original"] = point[cat];
          point[cat] = point[cat] / total;
        });
      }
    });
  }

  return stackedData;
}

function drawAreas(svg, stackedData, x, y, colorScale, tooltip, config) {
  const { data, timeDimension, categoricalDimension, measure, isNumericTime, isPercentage, categories } = config;

  const area = d3
    .area()
    .x((d) => x(d.data.time))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveBasis);

  svg
    .selectAll(".area")
    .data(stackedData)
    .enter()
    .append("path")
    .attr("class", "area")
    .attr("fill", (d) => colorScale(d.key))
    .attr("d", area)
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      const [mouseX] = d3.pointer(event, this);
      const timePoint = findClosestTimeForTooltip(mouseX, x, data);

      if (timePoint) {
        const category = d.key;
        const value = isPercentage ? timePoint[category + "_original"] : timePoint[category];
        const total = timePoint._total || categories.reduce((sum, cat) => sum + timePoint[cat], 0);
        const percentage = isPercentage ? timePoint[category] * 100 : (value / total) * 100;
        const timeStr = isNumericTime ? timePoint.time : d3.timeFormat("%Y-%m-%d")(timePoint.time);

        tooltip
          .style("opacity", 1)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px").html(`<strong>${categoricalDimension}:</strong> ${category}<br>
                <strong>${timeDimension}:</strong> ${timeStr}<br>
                <strong>${measure}:</strong> ${value.toLocaleString()}<br>
                <strong>Percentage:</strong> ${percentage.toFixed(1)}%`);
      }
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.8);
      tooltip.style("opacity", 0);
    });
}

function findClosestTimeForTooltip(mouseX, xScale, data) {
  const invertedX = xScale.invert(mouseX);
  const bisect = d3.bisector((d) => d.time).left;
  const index = bisect(data, invertedX);

  if (index === 0) return data[0];
  if (index >= data.length) return data[data.length - 1];

  const d0 = data[index - 1];
  const d1 = data[index];
  return invertedX - d0.time > d1.time - invertedX ? d1 : d0;
}

function addAxes(svg, x, y, height, isNumericTime, isPercentage) {
  // X Axis
  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(
      isNumericTime
        ? d3.axisBottom(x).tickFormat(d3.format("d"))
        : d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d"))
    );

  xAxis
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", isNumericTime ? "rotate(0)" : "rotate(-45)")
    .style("text-anchor", isNumericTime ? "middle" : "end")
    .style("font-size", chartStyles.fontSize.axis);

  xAxis.selectAll("line").style("stroke", "#ddd");
  xAxis.selectAll("path").style("stroke", "#ddd");

  // Y Axis
  const yAxis = svg
    .append("g")
    .call(isPercentage ? d3.axisLeft(y).tickFormat((d) => (d * 100).toFixed(0) + "%") : d3.axisLeft(y));

  yAxis.selectAll("line").style("stroke", "#ddd");
  yAxis.selectAll("path").style("stroke", "#ddd");
  yAxis.selectAll("text").style("font-size", chartStyles.fontSize.axis);
}
