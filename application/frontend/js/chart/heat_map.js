/**
 * Heat Map Component
 * Displays geospatial data using a heat/intensity map
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import { chartColors } from "./utils/chartColors.js";
import { formatValue, setupResizeHandler, validateRenderingContext } from "./utils/chartUtils.js";

/**
 * Main render function for heat map
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderHeatMap(container) {
  if (!validateRenderingContext(container, "No location data available for display")) return;

  // Extract data and dimensions
  const { dataset, geoDimension, measure } = extractChartData();

  // Process data for visualization
  const points = processLocationData(dataset, geoDimension, measure);
  if (points.length === 0) {
    container.innerHTML = "<p>No valid location data available to display.</p>";
    return;
  }

  // Set up map container with responsive dimensions
  const config = createChartConfig(container);
  const mapContainer = createMapContainer(container, config);

  // Create map and add data layer
  const map = initializeMap(mapContainer);
  addHeatLayer(map, points);
  fitMapToPoints(map, points);

  // Setup resize handling
  setupResizeHandler(container, () => renderHeatMap(container));
}

/**
 * Extract chart data from state
 */
function extractChartData() {
  const dataset = state.dataset;
  const geoDimension = state.aggregationDefinition.geoDimension?.[0];
  const measure = state.aggregationDefinition.measures?.[0]?.alias;

  if (!geoDimension || !measure) {
    throw new Error("Missing required dimensions or measures for heat map");
  }

  return { dataset, geoDimension, measure };
}

/**
 * Create chart configuration based on container
 */
function createChartConfig(container) {
  return {
    width: container.clientWidth,
    height: container.clientHeight || 500,
  };
}

/**
 * Process raw data into point data with coordinates and values
 */
function processLocationData(dataset, geoDimension, measure) {
  const points = [];

  dataset.forEach((record) => {
    const locationData = record[geoDimension];
    if (!locationData || locationData === "Unspecified") return;

    // Handle various location data formats
    let lat, lng;

    // If location is an object with x/y properties
    if (typeof locationData === "object" && locationData !== null) {
      lat = parseFloat(locationData.x);
      lng = parseFloat(locationData.y);
    }
    // If location is a string with comma-separated coordinates
    else if (typeof locationData === "string" && locationData.includes(",")) {
      const [latStr, lngStr] = locationData.split(",");
      lat = parseFloat(latStr.trim());
      lng = parseFloat(lngStr.trim());
    }

    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

    points.push({
      lat,
      lng,
      value: +record[measure] || 1,
    });
  });

  return points;
}

/**
 * Create a container element for the Leaflet map
 */
function createMapContainer(container, config) {
  // Clear container
  container.innerHTML = "";

  // Create responsive wrapper
  const wrapperDiv = document.createElement("div");
  wrapperDiv.className = "heat-map-wrapper";
  wrapperDiv.style.width = "100%";
  wrapperDiv.style.position = "relative";
  wrapperDiv.style.overflow = "hidden";
  container.appendChild(wrapperDiv);

  // Create map container with unique ID
  const mapContainer = document.createElement("div");
  mapContainer.id = "heat-map-" + Date.now();
  mapContainer.className = "heat-map-container";
  mapContainer.style.width = "100%";
  mapContainer.style.height = `${config.height}px`;
  mapContainer.style.boxSizing = "border-box";
  wrapperDiv.appendChild(mapContainer);

  return mapContainer;
}

/**
 * Initialize the Leaflet map with appropriate base layer
 */
function initializeMap(mapContainer) {
  // Create map centered on US
  const map = L.map(mapContainer.id, {
    center: [39.8283, -98.5795], // Center of the US
    zoom: 4,
    zoomControl: true,
    scrollWheelZoom: true,
  });

  // Add a clean, light-colored tile layer
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);

  return map;
}

/**
 * Add heatmap layer to the map using point data
 */
function addHeatLayer(map, points) {
  if (!points || points.length === 0) return;

  // Convert points to heatmap format [lat, lng, intensity]
  const heatData = points.map((point) => [point.lat, point.lng, point.value]);

  // Get max value for scaling
  const maxValue = Math.max(...points.map((p) => p.value));

  // Create custom gradient matching the screenshot (blue-purple-red-yellow)
  const gradient = {
    0.0: "#A1B1F3", // Light blue/purple
    0.2: "#D6A3F5", // Light purple
    0.4: "#B298DC", // Medium purple
    0.6: "#F79DA8", // Light salmon
    0.8: "#F9D3A0", // Light peach
    1.0: "#FFEA85", // Yellow
  };

  // Create and add heatmap layer with custom settings
  L.heatLayer(heatData, {
    radius: 12, // Size of each point's influence
    blur: 15, // Smoothing effect
    maxZoom: 17, // Maximum zoom level for heatmap
    max: maxValue * 0.7, // Scale intensity for better visualization
    gradient: gradient, // Custom gradient
  }).addTo(map);
}

/**
 * Adjust map viewport to fit all data points
 */
function fitMapToPoints(map, points) {
  if (!points || points.length === 0) return;

  // Create bounds that contain all points
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));

  // Fit map to these bounds with some padding
  map.fitBounds(bounds, {
    padding: [50, 50],
    maxZoom: 12, // Limit zoom level for better context
  });
}

/**
 * Add color legend to explain heat intensity
 */
function addColorLegend(container, measure) {
  const wrapperDiv = container.querySelector(".heat-map-wrapper");
  if (!wrapperDiv) return;

  // Create legend container
  const legendContainer = document.createElement("div");
  legendContainer.className = "heat-map-legend";
  Object.assign(legendContainer.style, {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    padding: "8px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: "4px",
    boxShadow: "0 0 5px rgba(0, 0, 0, 0.2)",
    zIndex: "1000",
    fontFamily: chartStyles.fontFamily,
    fontSize: "12px",
  });

  // Legend title
  const title = document.createElement("div");
  title.textContent = `${measure} Intensity`;
  title.style.fontWeight = "bold";
  title.style.marginBottom = "5px";
  legendContainer.appendChild(title);

  // Gradient bar
  const gradientBar = document.createElement("div");
  Object.assign(gradientBar.style, {
    width: "150px",
    height: "15px",
    marginBottom: "5px",
    background: "linear-gradient(to right, #A1B1F3, #D6A3F5, #B298DC, #F79DA8, #F9D3A0, #FFEA85)",
  });
  legendContainer.appendChild(gradientBar);

  // Labels container
  const labelsDiv = document.createElement("div");
  labelsDiv.style.display = "flex";
  labelsDiv.style.justifyContent = "space-between";

  // Low label
  const lowLabel = document.createElement("div");
  lowLabel.textContent = "Low";

  // High label
  const highLabel = document.createElement("div");
  highLabel.textContent = "High";

  labelsDiv.appendChild(lowLabel);
  labelsDiv.appendChild(highLabel);
  legendContainer.appendChild(labelsDiv);

  // Add legend to wrapper
  wrapperDiv.appendChild(legendContainer);
}

export default renderHeatMap;
export { renderHeatMap as renderHeatmap };
