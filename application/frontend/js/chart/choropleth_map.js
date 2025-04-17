/**
 * Choropleth Map Component
 * Displays geographic data with a measure value represented by color intensity
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { formatValue, setupResizeHandler, validateRenderingContext } from "./utils/chartUtils.js";

// Constants
const SUPPORTED_GEO_DIMENSIONS = ["borough", "neighborhood_name", "county"];
const COUNTY_MAPPING = {
  BRONX: "BRONX",
  BROOKLYN: "KINGS",
  MANHATTAN: "NEW YORK",
  QUEENS: "QUEENS",
  "STATEN ISLAND": "RICHMOND",
};

/**
 * Main render function for choropleth map
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderChoroplethMap(container) {
  if (!validateRenderingContext(container, "No geographic data available for display")) return;

  // Extract data and settings
  const dataset = state.dataset;
  const { geoDimension, measure } = extractDimensions();

  // Validate geo dimension
  if (!SUPPORTED_GEO_DIMENSIONS.includes(geoDimension)) {
    container.innerHTML = `<p>Geographic dimension "${geoDimension}" is not supported for map visualization.</p>`;
    return;
  }

  // Process data for visualization
  const { aggregatedData, maxValue } = processData(dataset, geoDimension, measure);

  // Create chart configuration and elements
  const config = createConfig(container, maxValue);
  const svg = createChartElements(container, config);
  const tooltip = chartStyles.createTooltip();

  // Load and render map components
  loadGeoJsonData(svg, container, geoDimension, aggregatedData, config, measure, tooltip);

  // Setup resize handling
  setupResizeHandler(container, () => renderChoroplethMap(container));
}

/**
 * Extract dimension and measure from state
 */
function extractDimensions() {
  const geoDimension = state.aggregationDefinition.geoDimension?.[0];
  const measure = state.aggregationDefinition.measures[0].alias;
  return { geoDimension, measure };
}

/**
 * Process data for map visualization
 */
function processData(dataset, geoDimension, measure) {
  const aggregatedData = {};

  dataset.forEach((d) => {
    let region = d[geoDimension];

    // Standardize borough and county names to uppercase
    if (geoDimension === "borough" || geoDimension === "county") {
      region = region?.toUpperCase();
    }

    // Skip undefined or "unspecified" regions
    if (!region || region === "Unspecified" || region.toLowerCase() === "unspecified") {
      return;
    }

    // Aggregate values
    aggregatedData[region] = (aggregatedData[region] || 0) + (+d[measure] || 0);
  });

  const maxValue = Math.max(...Object.values(aggregatedData), 0);
  return { aggregatedData, maxValue };
}

/**
 * Create chart configuration
 */
function createConfig(container, maxValue) {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  // Create color scale using sequential blues
  const colorScale = d3
    .scaleSequential()
    .domain([0, maxValue])
    .interpolator(d3.interpolate(chartColors.sequential.blue.light, chartColors.sequential.blue.base));

  return {
    width,
    height,
    colorScale,
    maxValue,
    margin: { top: 10, right: 30, bottom: 50, left: 30 },
  };
}

/**
 * Create chart DOM elements
 */
function createChartElements(container, config) {
  return d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "98%")
    .attr("preserveAspectRatio", "xMidYMid meet");
}

/**
 * Load GeoJSON and render map components
 */
function loadGeoJsonData(svg, container, geoDimension, aggregatedData, config, measure, tooltip) {
  const isNeighborhood = geoDimension === "neighborhood_name";
  const geoJsonFile = isNeighborhood
    ? "assets/geojson/2020_nyc_neighborhood_tabulation_areas_nta.geojson"
    : "assets/geojson/2025_nyc_borough.geojson";

  d3.json(geoJsonFile)
    .then((geoJson) => {
      // Set up projection to fit container
      const contentWidth = config.width - config.margin.left - config.margin.right;
      const contentHeight = config.height - config.margin.top - config.margin.bottom;

      const projection = d3.geoMercator().fitSize([contentWidth, contentHeight], geoJson);

      const path = d3.geoPath().projection(projection);

      // Process features with data
      const processedFeatures = processGeoFeatures(geoJson, geoDimension, aggregatedData);

      // Render map elements
      renderMap(svg, processedFeatures, path, config.colorScale, geoDimension, measure, tooltip);

      // Add labels for larger regions
      if (geoDimension === "borough" || geoDimension === "county") {
        addRegionLabels(svg, processedFeatures, path);
      }

      // Add color legend
      addColorLegend(svg, config);
    })
    .catch((error) => {
      console.error("Error loading map data:", error);
      container.innerHTML = `<p>Error loading map data: ${error.message}</p>`;
    });
}

/**
 * Process GeoJSON features to match with aggregated data
 */
function processGeoFeatures(geoJson, geoDimension, aggregatedData) {
  geoJson.features.forEach((feature) => {
    let regionName;
    const props = feature.properties;

    // Extract appropriate region name based on dimension
    if (geoDimension === "borough") {
      regionName = props.boroname?.toUpperCase();
    } else if (geoDimension === "neighborhood_name") {
      regionName = props.ntaname;
    } else if (geoDimension === "county") {
      const boroughName = props.boroname?.toUpperCase();
      regionName = COUNTY_MAPPING[boroughName];
      props.county = regionName;
    }

    // Assign value from aggregated data
    props.value = regionName ? aggregatedData[regionName] || 0 : 0;

    // Create display name for tooltips
    props.displayName =
      geoDimension === "county" && props.boroname
        ? `${props.county || props.boroname} County`
        : props.boroname || props.ntaname;
  });

  return geoJson;
}

/**
 * Render map regions with colors and interactions
 */
function renderMap(svg, geoJson, path, colorScale, geoDimension, measure, tooltip) {
  svg
    .selectAll("path.region")
    .data(geoJson.features)
    .join("path")
    .attr("class", "region")
    .attr("d", path)
    .attr("fill", (d) => colorScale(d.properties.value))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.5)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      highlightRegion(this);
      showRegionTooltip(event, d, tooltip, geoDimension, measure);
    })
    .on("mousemove", (event) => moveTooltip(event, tooltip))
    .on("mouseout", function () {
      resetRegionHighlight(this);
      chartStyles.tooltip.hide(tooltip);
    });
}

/**
 * Highlight a region on the map
 */
function highlightRegion(element) {
  d3.select(element).attr("stroke", "#333").attr("stroke-width", 1.5);
}

/**
 * Reset region highlight
 */
function resetRegionHighlight(element) {
  d3.select(element).attr("stroke", "#ffffff").attr("stroke-width", 0.5);
}

/**
 * Show tooltip for a map region
 */
function showRegionTooltip(event, feature, tooltip, geoDimension, measure) {
  const props = feature.properties;
  let content;

  if (geoDimension === "neighborhood_name") {
    content = `
      <strong>Neighborhood:</strong> ${props.ntaname}<br>
      <strong>Borough:</strong> ${props.boroname || "Unknown"}<br>
      <strong>${measure}:</strong> ${formatValue(props.value)}
    `;
  } else {
    content = `
      <strong>${props.displayName}</strong><br>
      <strong>${measure}:</strong> ${formatValue(props.value)}
    `;
  }

  chartStyles.tooltip.show(tooltip, event, content);
}

/**
 * Move tooltip with cursor
 */
function moveTooltip(event, tooltip) {
  tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY - 10 + "px");
}

/**
 * Add text labels for regions (boroughs or counties)
 */
function addRegionLabels(svg, geoJson, path) {
  svg
    .selectAll(".region-label")
    .data(geoJson.features)
    .join("text")
    .attr("class", "region-label")
    .attr("transform", (d) => `translate(${path.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .style("font-family", chartStyles.fontFamily)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#333")
    .style("text-shadow", "1px 1px 1px #fff, -1px -1px 1px #fff, 1px -1px 1px #fff, -1px 1px 1px #fff")
    .style("pointer-events", "none")
    .each(function (d) {
      const text = d3.select(this);
      const name = d.properties.displayName;
      const value = formatValue(d.properties.value);

      // Add name and value on separate lines
      text.append("tspan").attr("x", 0).attr("dy", "-0.7em").text(name);

      text.append("tspan").attr("x", 0).attr("dy", "1.4em").style("font-size", "11px").text(value);
    });
}

/**
 * Add color legend to the map
 */
function addColorLegend(svg, config) {
  const legendWidth = 300;
  const legendHeight = 10;
  const legendX = config.width - legendWidth - 20;
  const legendY = config.height - 40;

  const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${legendX}, ${legendY})`);

  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  gradient.append("stop").attr("offset", "0%").attr("stop-color", config.colorScale(0));
  gradient.append("stop").attr("offset", "100%").attr("stop-color", config.colorScale(config.maxValue));

  legend.append("rect").attr("width", legendWidth).attr("height", legendHeight).style("fill", "url(#legend-gradient)");

  const legendScale = d3.scaleLinear().domain([0, config.maxValue]).range([0, legendWidth]);
  const legendAxis = d3.axisBottom(legendScale).ticks(5);
  legend.append("g").attr("transform", `translate(0, ${legendHeight})`).call(legendAxis);
}

export default renderChoroplethMap;
