import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { createLegend } from "./utils/legendUtil.js";
import { chartStyles } from "./utils/chartStyles.js"; // Import the styles

function renderLineChart(container) {
  // Start from a clean slate
  container.innerHTML = "";

  // First create the legend + chart area structure
  let chartArea;
  if (
    state.aggregationDefinition.geoDimension?.length > 0 ||
    state.aggregationDefinition.categoricalDimension?.length > 0
  ) {
    // Get dimensions and data
    const { timeDimension, measure, groupDimension } = extractDimensions();
    const dataset = state.dataset;

    // If we have grouping, set up the flex container and legend first
    const uniqueGroups = [...new Set(dataset.map((d) => d[groupDimension]))];
    const colorScale = chartStyles.getColorScale(uniqueGroups);

    // Create flex container
    const flexContainer = document.createElement("div");
    flexContainer.style.display = "flex";
    flexContainer.style.width = "100%";
    flexContainer.style.height = "100%";

    // Create chart area
    chartArea = document.createElement("div");
    chartArea.className = "chart-area";
    chartArea.style.width = "80%";

    // Create legend area
    const legendDiv = document.createElement("div");
    legendDiv.className = "chart-legend";
    legendDiv.style.width = "20%";
    legendDiv.style.padding = "10px";
    legendDiv.style.overflowY = "auto";
    legendDiv.style.borderLeft = "1px solid #ddd";

    // Build the legend content
    uniqueGroups.forEach((item, i) => {
      const itemDiv = document.createElement("div");
      itemDiv.style.display = "flex";
      itemDiv.style.alignItems = "center";
      itemDiv.style.marginBottom = "8px";

      const colorBox = document.createElement("span");
      colorBox.style.width = "15px";
      colorBox.style.height = "15px";
      colorBox.style.backgroundColor = colorScale(item);
      colorBox.style.border = "1px solid #000";
      colorBox.style.marginRight = "8px";

      const label = document.createElement("span");
      label.style.fontSize = chartStyles.fontSize.legend;
      label.style.fontFamily = chartStyles.fontFamily;
      label.style.color = "#333";
      label.textContent = item;

      itemDiv.appendChild(colorBox);
      itemDiv.appendChild(label);
      legendDiv.appendChild(itemDiv);
    });

    // Assemble the layout
    flexContainer.appendChild(chartArea);
    flexContainer.appendChild(legendDiv);
    container.appendChild(flexContainer);
  } else {
    // No grouping, just use the container directly
    chartArea = container;
  }

  // Now proceed with chart drawing on the chartArea
  // Rest of your chart rendering logic goes here...

  // Get data and setup
  const dataset = state.dataset;
  const { timeDimension, measure, groupDimension } = extractDimensions();
  const isNumericTime = /_datepart$/.test(timeDimension);

  // Set up chart area and dimensions
  const { margin, width, height, svg } = setupChart(chartArea);

  // Create tooltip
  const tooltip = chartStyles.createTooltip();

  // Process data (parse dates or handle numeric time values)
  let processedData;
  if (isNumericTime) {
    // For numeric time dimensions, just ensure the value is a number
    processedData = dataset
      .map((d) => ({
        ...d,
        parsedTime: +d[timeDimension],
      }))
      .filter((d) => !isNaN(d.parsedTime));
  } else {
    // For date-based time dimensions, parse as dates
    processedData = prepareData(dataset, timeDimension);
  }

  if (processedData.length === 0) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("No valid time data available");
    return;
  }

  // Create scales based on processed data
  const x = isNumericTime
    ? d3
        .scaleLinear()
        .domain(d3.extent(processedData, (d) => d.parsedTime))
        .range([0, width])
        .nice()
    : d3
        .scaleTime()
        .domain(d3.extent(processedData, (d) => d.parsedTime))
        .range([0, width])
        .nice();

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(processedData, (d) => +d[measure])])
    .range([height, 0])
    .nice();

  // Create line generator
  const lineGenerator = d3
    .line()
    .x((d) => x(d.parsedTime))
    .y((d) => y(+d[measure]))
    .curve(d3.curveMonotoneX);

  // Add axes with consistent styling
  addXAxis(svg, x, height, isNumericTime);
  addYAxis(svg, y);

  // Draw the appropriate visualization based on grouping
  if (groupDimension) {
    const uniqueGroups = [...new Set(processedData.map((d) => d[groupDimension]))];
    const colorScale = chartStyles.getColorScale(uniqueGroups);

    // Add timeDimension parameter to the function call
    drawGroupedLines(
      svg,
      processedData,
      groupDimension,
      lineGenerator,
      tooltip,
      measure,
      colorScale,
      timeDimension,
      isNumericTime
    );

    // Don't recreate the legend if it exists
    if (!container.querySelector(".chart-legend")) {
      createLegend(container, uniqueGroups, colorScale);
    }
  } else {
    drawSingleLine(svg, processedData, lineGenerator, tooltip, measure, timeDimension);
  }
}

// Extract dimensions and measure from state
function extractDimensions() {
  const timeDimension = state.aggregationDefinition.timeDimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Look for an additional grouping dimension (either categorical or geo)
  let groupDimension = null;
  if (state.aggregationDefinition.categoricalDimension && state.aggregationDefinition.categoricalDimension.length > 0) {
    groupDimension = state.aggregationDefinition.categoricalDimension[0];
  } else if (state.aggregationDefinition.geoDimension && state.aggregationDefinition.geoDimension.length > 0) {
    groupDimension = state.aggregationDefinition.geoDimension[0];
  }

  return { timeDimension, measure, groupDimension };
}

// Parse time data and filter invalid records
function prepareData(dataset, timeDimension) {
  const parseTime = d3.timeParse("%Y-%m-%d");
  return dataset.map((d) => ({ ...d, parsedTime: parseTime(d[timeDimension]) })).filter((d) => d.parsedTime);
}

// Set up chart container and SVG
function setupChart(container) {
  const margin = { top: 20, right: 20, bottom: 70, left: 70 };

  // Since container might be the original container or the chartArea,
  // adjust the width for the chartArea case
  const isChartArea = container.className === "chart-area";
  const width = (isChartArea ? CHART_DIMENSIONS.width * 0.8 : CHART_DIMENSIONS.width) - margin.left - margin.right;
  const height = CHART_DIMENSIONS.height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return { margin, width, height, svg };
}

// Create x and y scales for the chart
function createScales(data, measure, width, height) {
  // X scale uses the full time extent
  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.parsedTime))
    .range([0, width]);

  // Y scale for the measure values
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[measure])])
    .range([height, 0]);

  return { x, y };
}

// Create line generator function
function createLineGenerator(x, y, measure) {
  return d3
    .line()
    .curve(d3.curveMonotoneX)
    .x((d) => x(d.parsedTime))
    .y((d) => y(d[measure]));
}

// Draw grouped lines with tooltips - completely refactored approach
function drawGroupedLines(
  svg,
  data,
  groupDimension,
  lineGenerator,
  tooltip,
  measure,
  colorScale,
  timeDimension,
  isNumericTimeCheck
) {
  // Group data by the grouping dimension
  const groupedData = d3.group(data, (d) => d[groupDimension]);

  // Create array of processed groups
  const groups = Array.from(groupedData, ([key, values]) => {
    // Sort values chronologically
    const sortedValues = values.sort((a, b) => a.parsedTime - b.parsedTime);
    return { key, values: sortedValues };
  });

  // Draw lines - one per group
  const lines = svg
    .append("g")
    .attr("class", "lines")
    .selectAll("path")
    .data(groups)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", (d) => colorScale(d.key))
    .attr("stroke-width", 2)
    .attr("d", (d) => lineGenerator(d.values));

  // Create a voronoi overlay for better mouse interaction
  // This avoids the need to create points for each data point
  const allPoints = [];
  groups.forEach((group) => {
    group.values.forEach((d) => {
      allPoints.push({
        x: lineGenerator.x()(d),
        y: lineGenerator.y()(d),
        data: d,
        group: group.key,
      });
    });
  });

  // Create interaction layer
  const interactionLayer = svg.append("g").attr("class", "interaction-layer");

  // Add an invisible rectangle to capture mouse events
  const overlayRect = interactionLayer
    .append("rect")
    .attr("width", svg.attr("width"))
    .attr("height", svg.attr("height"))
    .style("fill", "none")
    .style("pointer-events", "all");

  // Create a highlight circle that will follow the closest point
  const highlight = interactionLayer
    .append("circle")
    .attr("r", 5)
    .style("fill", "none")
    .style("stroke", "black")
    .style("stroke-width", 2)
    .style("opacity", 0);

  // Add mouse interaction
  overlayRect
    .on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event);

      // Find the closest point to the mouse
      let minDist = Infinity;
      let closestPoint = null;

      allPoints.forEach((point) => {
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        const dist = dx * dx + dy * dy; // Squared distance is faster than Math.sqrt

        if (dist < minDist) {
          minDist = dist;
          closestPoint = point;
        }
      });

      // Only show tooltip if we're reasonably close to a point
      if (closestPoint && minDist < 900) {
        // 30px squared radius
        // Move highlight to the closest point
        highlight
          .attr("cx", closestPoint.x)
          .attr("cy", closestPoint.y)
          .style("fill", colorScale(closestPoint.group))
          .style("opacity", 0.8);

        // Show tooltip
        const d = closestPoint.data;
        const timeLabel = isNumericTimeCheck ? d.parsedTime : d3.timeFormat("%Y-%m-%d")(d.parsedTime);

        tooltip
          .style("opacity", 0.9)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px").html(`
            <strong>${groupDimension}:</strong> ${closestPoint.group}<br>
            <strong>${timeDimension}:</strong> ${timeLabel}<br>
            <strong>${measure}:</strong> ${d3.format(".2f")(+d[measure])}
          `);
      } else {
        // Hide highlight and tooltip if we're not close to any point
        highlight.style("opacity", 0);
        tooltip.style("opacity", 0);
      }
    })
    .on("mouseleave", function () {
      // Hide highlight and tooltip when leaving the chart area
      highlight.style("opacity", 0);
      tooltip.style("opacity", 0);
    });
}

// Draw a single line for non-grouped data with tooltips
function drawSingleLine(svg, data, lineGenerator, tooltip, measure, timeDimension) {
  // Sort data by time
  const sortedData = data.sort((a, b) => a.parsedTime - b.parsedTime);

  // Draw the line
  svg
    .append("path")
    .datum(sortedData)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", lineGenerator);

  // Create array of all data points for interaction
  const points = sortedData.map((d) => ({
    x: lineGenerator.x()(d),
    y: lineGenerator.y()(d),
    data: d,
  }));

  // Create interaction layer
  const interactionLayer = svg.append("g").attr("class", "interaction-layer");

  // Add an invisible rectangle to capture mouse events
  const overlayRect = interactionLayer
    .append("rect")
    .attr("width", svg.attr("width"))
    .attr("height", svg.attr("height"))
    .style("fill", "none")
    .style("pointer-events", "all");

  // Create a highlight circle that will follow the closest point
  const highlight = interactionLayer.append("circle").attr("r", 5).style("fill", "steelblue").style("opacity", 0);

  // Add mouse interaction
  overlayRect
    .on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event);

      // Find the closest point to the mouse
      let minDist = Infinity;
      let closestPoint = null;

      points.forEach((point) => {
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        const dist = dx * dx + dy * dy;

        if (dist < minDist) {
          minDist = dist;
          closestPoint = point;
        }
      });

      // Only show tooltip if we're reasonably close to a point
      if (closestPoint && minDist < 900) {
        // Move highlight to the closest point
        highlight.attr("cx", closestPoint.x).attr("cy", closestPoint.y).style("opacity", 0.8);

        // Show tooltip
        const d = closestPoint.data;
        const timeLabel = typeof d.parsedTime === "number" ? d.parsedTime : d3.timeFormat("%Y-%m-%d")(d.parsedTime);

        tooltip
          .style("opacity", 0.9)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px").html(`
            <strong>${timeDimension}:</strong> ${timeLabel}<br>
            <strong>${measure}:</strong> ${d3.format(".2f")(+d[measure])}
          `);
      } else {
        // Hide highlight and tooltip if we're not close to any point
        highlight.style("opacity", 0);
        tooltip.style("opacity", 0);
      }
    })
    .on("mouseleave", function () {
      // Hide highlight and tooltip when leaving the chart area
      highlight.style("opacity", 0);
      tooltip.style("opacity", 0);
    });
}

// Add x-axis to the chart with consistent styling
function addXAxis(svg, x, height, isNumericTime) {
  const axis = svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(
      isNumericTime
        ? d3.axisBottom(x).tickFormat(d3.format("d")) // Integer format for numeric time
        : d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m-%d")) // Date format for time dimensions
    );

  // Apply label rotation (can be different for numeric vs date)
  axis
    .selectAll("text")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", isNumericTime ? "rotate(-0)" : "rotate(-45)") // different rotation for numeric
    .style("text-anchor", isNumericTime ? "middle" : "end");

  // Apply consistent styling
  axis.call((g) => chartStyles.applyAxisStyles(g));
}

// Add y-axis to the chart with consistent styling
function addYAxis(svg, y) {
  svg
    .append("g")
    .call(d3.axisLeft(y))
    .call((g) => chartStyles.applyAxisStyles(g));
}

// Helper function to check if a value is numeric time
function isNumericTime(value) {
  return typeof value === "number";
}

export default renderLineChart;
