import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";

/**
 * Main function to render a heatmap from location data
 */
function renderHeatMap(container) {
  // Clear container and get configuration
  container.innerHTML = "";
  const { width, height } = CHART_DIMENSIONS;

  // Extract data from state
  const dataset = state.dataset;
  const geoDim = state.aggregationDefinition.geoDimension[0]; // location field
  const measure = state.aggregationDefinition.measures[0].alias;

  // Process data for visualization
  const points = processLocationData(dataset, geoDim, measure);
  if (points.length === 0) {
    container.innerHTML = "<p>No valid location data available to display.</p>";
    return;
  }

  // Setup and render map
  const mapContainer = createMapContainer(container, width, height);
  const map = setupLeafletMap(mapContainer);
  addHeatLayer(map, points);
  fitMapToPoints(map, points);
}

/**
 * Process raw data into point data with coordinates and values
 */
function processLocationData(dataset, geoDim, measure) {
  const points = [];

  dataset.forEach((record) => {
    const locationStr = record[geoDim];

    if (!locationStr || locationStr === "Unspecified") return;

    // Extract coordinates from string format: "(lat, lng)"
    const coordMatch = locationStr.match(/\(([^,]+),\s*([^)]+)\)/);
    if (!coordMatch || coordMatch.length !== 3) return;

    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);

    if (isNaN(lat) || isNaN(lng)) return;

    points.push({
      lat,
      lng,
      value: +record[measure] || 0,
    });
  });

  return points;
}

/**
 * Create a container element for the Leaflet map
 */
function createMapContainer(container, width, height) {
  const mapContainer = document.createElement("div");
  mapContainer.id = "leaflet-map";
  mapContainer.style.width = `${width}px`;
  mapContainer.style.height = `${height}px`;
  container.appendChild(mapContainer);

  return mapContainer;
}

/**
 * Initialize the Leaflet map with appropriate base layer
 */
function setupLeafletMap(mapContainer) {
  // Create map centered on NYC
  const map = L.map(mapContainer.id).setView([40.7128, -74.006], 10);

  // Add a minimal light-colored tile layer
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
  // Convert points to heatmap format [lat, lng, intensity]
  const heatData = points.map((point) => [point.lat, point.lng, point.value]);

  // Create and add heatmap layer with custom settings
  L.heatLayer(heatData, {
    radius: 8, // Size of each point's influence
    blur: 10, // Smoothing effect
    maxZoom: 18, // Maximum zoom level for heatmap
    gradient: {
      0: "yellow",
      0.5: "lime",
      0.75: "yellow",
      1.0: "red",
    },
  }).addTo(map);
}

/**
 * Adjust map viewport to fit all data points
 */
function fitMapToPoints(map, points) {
  if (points.length === 0) return;

  // Create bounds that contain all points
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));

  // Fit map to these bounds with some padding
  map.fitBounds(bounds, {
    padding: [50, 50],
    maxZoom: 15, // Avoid zooming in too far
  });
}

// Export functions with consistent naming
export default renderHeatMap;
export { renderHeatMap as renderHeatmap };
