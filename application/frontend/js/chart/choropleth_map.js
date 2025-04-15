import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

function renderMap(container) {
  const dataset = state.dataset;
  const geoDim = state.aggregationDefinition.geoDimension[0];
  const measure = state.aggregationDefinition.measures[0].alias;

  // Validate geo dimension
  if (!isValidGeoDimension(geoDim)) {
    container.innerHTML = `<p>Geo dimension "${geoDim}" is not supported for map visualization.</p>`;
    return;
  }

  // Process data
  const aggregatedData = aggregateDataByRegion(dataset, geoDim, measure);

  // Set up chart parameters
  const { width, height, maxVal, colorScale } = setupChartParameters(aggregatedData);

  // Create SVG container
  const svg = createSvgContainer(container, width, height);

  // Load and render map
  loadGeoJsonAndRender(svg, container, geoDim, aggregatedData, width, height, maxVal, colorScale, measure);
}

// Check if the geo dimension is supported
function isValidGeoDimension(geoDim) {
  return geoDim === "borough" || geoDim === "neighborhood_name" || geoDim === "county";
}

// Aggregate data by region
function aggregateDataByRegion(dataset, geoDim, measure) {
  const aggregatedData = {};

  dataset.forEach((d) => {
    let region;
    if (geoDim === "borough" || geoDim === "county") {
      region = d[geoDim].toUpperCase();
    } else {
      region = d[geoDim];
    }

    if (region && region !== "Unspecified" && !(region in aggregatedData)) {
      aggregatedData[region] = +d[measure];
    }
  });

  return aggregatedData;
}

// Setup chart parameters
function setupChartParameters(aggregatedData) {
  const width = CHART_DIMENSIONS.width || 800;
  const height = CHART_DIMENSIONS.height || 600;
  const maxVal = d3.max(Object.values(aggregatedData));
  const colorScale = d3.scaleSequential(d3.interpolateOrRd).domain([0, maxVal]);

  return { width, height, maxVal, colorScale };
}

// Create SVG container
function createSvgContainer(container, width, height) {
  // Create responsive SVG with viewBox for better scaling
  return d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "auto")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
}

// Load GeoJSON and render map
function loadGeoJsonAndRender(svg, container, geoDim, aggregatedData, width, height, maxVal, colorScale, measure) {
  // Choose the appropriate GeoJSON file based on geoDim
  const geoJsonFile =
    geoDim === "borough" || geoDim === "county"
      ? "assets/geojson/2025_nyc_borough.geojson"
      : "assets/geojson/2020_nyc_neighborhood_tabulation_areas_nta.geojson";

  d3.json(geoJsonFile).then((geojsonData) => {
    // Setup projection
    const { projection, path } = setupProjection(geojsonData, width, height);

    // Process features
    processFeatures(geojsonData, geoDim, aggregatedData);

    // Render map paths
    renderPaths(svg, geojsonData, path, colorScale);

    // Add labels only for borough or county level
    if (geoDim === "borough" || geoDim === "county") {
      addMapLabels(svg, geojsonData, path, geoDim);
    }

    // Add tooltip interaction
    addTooltipInteraction(svg, container, geoDim, measure);

    // Add legend
    addLegend(svg, width, height, colorScale, maxVal);
  });
}

// Setup map projection
function setupProjection(geojsonData, width, height) {
  const projection = d3.geoMercator().fitSize([width, height], geojsonData);
  const path = d3.geoPath().projection(projection);

  return { projection, path };
}

// Process GeoJSON features
function processFeatures(geojsonData, geoDim, aggregatedData) {
  // Borough to County mapping for county dimension
  const countyMapping = {
    BRONX: "BRONX",
    BROOKLYN: "KINGS",
    MANHATTAN: "NEW YORK",
    QUEENS: "QUEENS",
    "STATEN ISLAND": "RICHMOND",
  };

  // Dataset to Borough GeoJSON mapping (handles different capitalization)
  const boroughMapping = {
    BRONX: "Bronx",
    BROOKLYN: "Brooklyn",
    MANHATTAN: "Manhattan",
    QUEENS: "Queens",
    "STATEN ISLAND": "Staten Island",
  };

  geojsonData.features.forEach((feature) => {
    let regionName;

    // Different property access based on geoDim and GeoJSON type
    if (geoDim === "borough") {
      // For borough geojson, boroname is already in proper format
      if (feature.properties.boroname) {
        // Borough GeoJSON uses title case (Brooklyn), dataset uses uppercase (BROOKLYN)
        regionName = feature.properties.boroname.toUpperCase();
      } else {
        // For neighborhood GeoJSON, extract borough name
        regionName = feature.properties.boroname
          ? feature.properties.boroname.toUpperCase()
          : feature.properties.borough;
      }
    } else if (geoDim === "neighborhood_name") {
      regionName = feature.properties.ntaname;
    } else if (geoDim === "county") {
      if (feature.properties.boroname) {
        // Borough GeoJSON - map borough name to county name
        regionName = countyMapping[feature.properties.boroname.toUpperCase()];
        feature.properties.county = regionName;
      } else {
        // Neighborhood GeoJSON
        regionName = countyMapping[feature.properties.boroname.toUpperCase()];
        feature.properties.county = regionName;
      }
    }

    // Assign aggregated value to the feature
    feature.properties.aggValue = regionName && regionName !== "UNSPECIFIED" ? aggregatedData[regionName] || 0 : 0;
  });
}

// Render map paths
function renderPaths(svg, geojsonData, path, colorScale) {
  svg
    .selectAll("path")
    .data(geojsonData.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", (d) => colorScale(d.properties.aggValue))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.5);
}

// Add text labels to the map for borough/county level
function addMapLabels(svg, geojsonData, path, geoDim) {
  svg
    .selectAll(".map-label")
    .data(geojsonData.features)
    .enter()
    .append("text")
    .attr("class", "map-label")
    .attr("transform", (d) => {
      // Calculate centroid of each feature for label positioning
      const centroid = path.centroid(d);
      return `translate(${centroid[0]}, ${centroid[1]})`;
    })
    .attr("text-anchor", "middle")
    .attr("dy", ".35em") // Vertically center text
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#333")
    .style("text-shadow", "1px 1px 1px #fff, -1px -1px 1px #fff, 1px -1px 1px #fff, -1px 1px 1px #fff") // Text outline for readability
    .text((d) => {
      // Display appropriate label based on dimension
      let regionName = "";

      if (geoDim === "borough") {
        regionName = d.properties.boroname;
      } else if (geoDim === "county") {
        // Get county name from boroname mapping
        const boroughName = d.properties.boroname;
        const countyMapping = {
          Bronx: "BRONX",
          Brooklyn: "KINGS",
          Manhattan: "NEW YORK",
          Queens: "QUEENS",
          "Staten Island": "RICHMOND",
        };
        regionName = countyMapping[boroughName] + " County";
      }

      // Format measure value with thousands separators and up to 2 decimal places
      const formattedValue = d.properties.aggValue !== undefined ? d3.format(",.2~f")(d.properties.aggValue) : "N/A";

      // Combine region name and measure value
      return `${regionName}\n${formattedValue}`;
    })
    // Add multiline text support
    .each(function () {
      const text = d3.select(this);
      const lines = text.text().split("\n");

      text.text(null); // Clear existing text

      // Add first line (region name)
      text
        .append("tspan")
        .attr("x", 0)
        .attr("dy", "-0.7em") // Move up from center
        .text(lines[0]);

      // Add second line (measure value)
      text
        .append("tspan")
        .attr("x", 0)
        .attr("dy", "1.4em") // Move down for second line
        .style("font-size", "11px") // Slightly smaller font for the value
        .text(lines[1]);
    });
}

// Add tooltip interaction
function addTooltipInteraction(svg, container, geoDim, measure) {
  svg
    .selectAll("path")
    .on("mouseover", function (event, d) {
      let displayName;

      // Get the appropriate display name based on the feature properties
      if (geoDim === "borough") {
        displayName = d.properties.boroname || d.properties.borough;
      } else if (geoDim === "county") {
        displayName = d.properties.county ? `${d.properties.county} County` : "";
      } else {
        displayName = d.properties.ntaname;
      }

      // Create tooltip
      const tooltip = d3
        .select(container)
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("padding", "5px")
        .style("border", "1px solid #000")
        .html(`<strong>${displayName}</strong><br><strong>${measure}:</strong> ${d.properties.aggValue}`);

      tooltip.style("left", event.pageX + 5 + "px").style("top", event.pageY + 5 + "px");
    })
    .on("mouseout", () => {
      d3.select(container).select(".tooltip").remove();
    });
}

// Add color scale legend
function addLegend(svg, width, height, colorScale, maxVal) {
  const legendWidth = 300;
  const legendHeight = 10;
  const legendX = width - legendWidth - 20;
  const legendY = height - 40;

  const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${legendX}, ${legendY})`);

  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(0));
  gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(maxVal));

  legend.append("rect").attr("width", legendWidth).attr("height", legendHeight).style("fill", "url(#legend-gradient)");

  const legendScale = d3.scaleLinear().domain([0, maxVal]).range([0, legendWidth]);
  const legendAxis = d3.axisBottom(legendScale).ticks(5);
  legend.append("g").attr("transform", `translate(0, ${legendHeight})`).call(legendAxis);
}

export default renderMap;
