/**
 * Choropleth Map Component
 * Displays geographic data with color intensity representing measure values
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import * as chartUtils from "./utils/chartUtils.js";

// Constants
const SUPPORTED_GEO_DIMENSIONS = ["borough", "neighborhood_name", "county", "incident_zip"];

// Geographic configuration for different dimension types
const GEO_CONFIG = {
  borough: {
    geoFile: "assets/geojson/2020_nyc_neighborhood_tabulation_areas_borough.geojson",
    idField: "boroname",
    idTransform: (name) => name?.toUpperCase(),
    displayField: "boroname",
    showLabels: true,
  },
  neighborhood_name: {
    geoFile: "assets/geojson/2020_nyc_neighborhood_tabulation_areas_nta.geojson",
    idField: "ntaname",
    displayField: "ntaname",
    showLabels: false,
  },
  county: {
    geoFile: "assets/geojson/2020_nyc_neighborhood_tabulation_areas_borough.geojson",
    idField: "county",
    displayField: "county",
    displayTransform: (props) => {
      const countyNameMap = {
        BRONX: "Bronx",
        KINGS: "Kings",
        "NEW YORK": "New York",
        QUEENS: "Queens",
        RICHMOND: "Richmond",
      };
      return `${countyNameMap[props.county] || props.county} County`;
    },
    showLabels: true,
  },
  incident_zip: {
    geoFile: "assets/geojson/modified_zip_code_tabulation_areas.geojson",
    idField: "modzcta",
    displayField: "label",
    displayFallback: "modzcta",
    showLabels: false,
  },
};

/**
 * Main render function for choropleth map
 */
function renderChoroplethMap(container) {
  // Validate rendering context
  if (!chartUtils.validateRenderingContext(container)) return;

  // Extract dimension and measure from state
  const { geoDimension, measure } = {
    geoDimension: state.aggregationDefinition?.geoDimension?.[0] || "",
    measure: state.aggregationDefinition?.measures?.[0]?.alias || "",
  };

  // Check if dimension is supported
  if (!SUPPORTED_GEO_DIMENSIONS.includes(geoDimension)) {
    container.innerHTML = `<p>Geographic dimension "${geoDimension}" is not supported.</p>`;
    return;
  }

  // Prepare data - since it's already aggregated, just index it for lookups
  const { dataIndex, maxValue } = prepareData(state.dataset, geoDimension, measure);
  if (maxValue <= 0) {
    container.innerHTML = `<p>No data available for this geographic dimension.</p>`;
    return;
  }

  // Set up chart components
  const config = {
    width: container.clientWidth || 800,
    height: container.clientHeight || 500,
    maxValue,
    margin: { top: 10, right: 30, bottom: 50, left: 30 },
    colorScale: d3
      .scaleSequential()
      .domain([0, maxValue])
      .interpolator(d3.interpolate(chartColors.sequential.blue.light, chartColors.sequential.blue.base)),
  };

  // Create base SVG and tooltip
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "98%")
    .attr("preserveAspectRatio", "xMidYMid meet");

  const tooltip = chartStyles.createTooltip();

  // Load and render map
  renderMap(svg, container, geoDimension, dataIndex, config, measure, tooltip);

  // Handle resize
  chartUtils.setupResizeHandler(container, () => renderChoroplethMap(container));
}

/**
 * Prepare data for visualization
 */
function prepareData(dataset, geoDimension, measure) {
  const dataIndex = {};
  let maxValue = 0;

  // Index data by region for quick lookup
  dataset.forEach((d) => {
    // Skip invalid entries
    if (
      !d[geoDimension] ||
      d[geoDimension] === "Unspecified" ||
      (geoDimension === "incident_zip" && d[geoDimension] === "99999")
    ) {
      return;
    }

    // Get region name, applying transformation if needed
    let region = d[geoDimension];
    const transform = GEO_CONFIG[geoDimension]?.idTransform;
    if (transform) region = transform(region);

    dataIndex[region] = d;
    maxValue = Math.max(maxValue, +d[measure] || 0);
  });

  return { dataIndex, maxValue };
}

/**
 * Load and render GeoJSON map
 */
function renderMap(svg, container, geoDimension, dataIndex, config, measure, tooltip) {
  const geoConfig = GEO_CONFIG[geoDimension];

  // Create a consistent projection for all map types
  const projection = d3
    .geoMercator()
    .center([-73.97, 40.705])
    .scale(config.width * 45)
    .translate([config.width / 2, config.height / 2]);

  const path = d3.geoPath().projection(projection);

  d3.json(geoConfig.geoFile)
    .then((geoJson) => {
      // Attach data to features - keep this part the same
      geoJson.features.forEach((feature) => {
        const props = feature.properties;
        const id = props[geoConfig.idField];

        // Apply ID transformation if configured
        const lookupKey = geoConfig.idTransform ? geoConfig.idTransform(id) : id;

        // Get data for this region
        const dataItem = dataIndex[lookupKey];
        props.value = dataItem ? +dataItem[measure] || 0 : 0;

        // Set display name
        if (geoConfig.displayTransform) {
          props.displayName = geoConfig.displayTransform(props);
        } else {
          props.displayName = props[geoConfig.displayField] || props[geoConfig.displayFallback] || id;
        }

        // Store reference to data item for tooltip
        props.dataItem = dataItem;
      });

      // Render regions
      renderRegions(svg, geoJson, path, config.colorScale, geoDimension, measure, tooltip);

      // Add labels if configured
      if (geoConfig.showLabels) {
        addRegionLabels(svg, geoJson, path, measure);
      }

      // Add legend
      addLegend(svg, config);
    })
    .catch((error) => {
      console.error("Error loading map data:", error);
      container.innerHTML = `<p>Error loading map data: ${error.message}</p>`;
    });
}

/**
 * Render map regions with colors and tooltips
 */
function renderRegions(svg, geoJson, path, colorScale, geoDimension, measure, tooltip) {
  const regions = svg
    .selectAll("path.region")
    .data(geoJson.features)
    .join("path")
    .attr("class", "region")
    .attr("d", path)
    .attr("fill", (d) => (d.properties.value > 0 ? colorScale(d.properties.value) : "#F5F5F5"))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.5)
    .style("cursor", (d) => (d.properties.value > 0 ? "pointer" : "default"));

  // Replace custom tooltip handling with standard utility function
  chartUtils.attachMouseTooltip(
    regions,
    tooltip,
    (d) => {
      // Only show tooltip for regions with data
      if (!d.properties.value || d.properties.value <= 0) return "";

      // Use the same standardized tooltip content
      return createTooltipContent(d, geoDimension, measure);
    },
    // Custom highlight function for polygon elements
    (el, d) => {
      if (!d || !d.properties.value || d.properties.value <= 0) {
        // Reset to original color or default fill
        const origFill = el.property("__origFill") || "#F5F5F5";
        el.attr("fill", origFill);
        return;
      }

      // Get original fill or use the computed color
      const origFill = el.property("__origFill") || colorScale(d.properties.value);

      // Apply darker fill for highlight
      el.attr("fill", d3.color(origFill).darker(0.3));
    }
  );
}

/**
 * Create tooltip content
 */
function createTooltipContent(feature, geoDimension, measure) {
  const p = feature.properties;

  // Get appropriate borough name
  let boroughName = p.dataItem?.reference_borough || p.boroname || "Unknown";

  // Build dimensions and measures arrays for standardized tooltip
  const dimensions = [];
  const measures = [];

  // Add dimensions (top section)
  if (geoDimension === "neighborhood_name") {
    dimensions.push({ name: "neighborhood_name", value: p.ntaname }, { name: "borough", value: boroughName });
  } else if (geoDimension === "incident_zip") {
    dimensions.push({ name: "ZIP Code", value: p.displayName }, { name: "borough", value: boroughName });
  } else {
    dimensions.push({ name: geoDimension, value: p.displayName });
  }

  // Add measures (bottom section)
  measures.push({
    name: measure,
    value: p.value,
    field: measure,
  });

  // Create standardized tooltip
  return chartUtils.createStandardTooltip({
    dimensions: dimensions,
    measures: measures,
  });
}

/**
 * Add labels to regions
 */
function addRegionLabels(svg, geoJson, path, measure) {
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
      text.append("tspan").attr("x", 0).attr("dy", "-0.7em").text(d.properties.displayName);

      text
        .append("tspan")
        .attr("x", 0)
        .attr("dy", "1.4em")
        .style("font-size", "11px")
        .text(chartUtils.formatFullNumber(d.properties.value, measure));
    });
}

/**
 * Add color legend
 */
function addLegend(svg, config) {
  const legendWidth = 300;
  const legendHeight = 10;
  const legendX = config.width - legendWidth - 20;
  const legendY = config.height - 40;

  // Create gradient
  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  gradient.append("stop").attr("offset", "0%").attr("stop-color", config.colorScale(0));
  gradient.append("stop").attr("offset", "100%").attr("stop-color", config.colorScale(config.maxValue));

  // Create legend group
  const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${legendX}, ${legendY})`);

  // Add gradient rectangle
  legend.append("rect").attr("width", legendWidth).attr("height", legendHeight).style("fill", "url(#legend-gradient)");

  // Add axis
  const legendScale = d3.scaleLinear().domain([0, config.maxValue]).range([0, legendWidth]);
  legend.append("g").attr("transform", `translate(0, ${legendHeight})`).call(d3.axisBottom(legendScale).ticks(5));
}

export default renderChoroplethMap;
