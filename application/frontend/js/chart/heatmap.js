/**
 * Heat Map Component
 * Displays geospatial data as a heat intensity map with Leaflet
 */
import { state } from "../state.js";
import { chartStyles } from "./utils/chartStyles.js";
import * as chartUtils from "./utils/chartUtils.js";

// Constants
const DEFAULT_ZOOM = 4;
const US_CENTER = [39.8283, -98.5795];
const POINT_PROXIMITY_THRESHOLD = 0.01;
const HEAT_SETTINGS = {
  radius: 7.5,
  blur: 5,
  maxZoom: 1,
  minOpacity: 0.3,
  gradient: {
    0: "navy",
    0.25: "cyan",
    0.5: "yellow",
    0.75: "orange",
    1.0: "red",
  },
};

/**
 * Main render function for heat map
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderHeatMap(container) {
  if (!chartUtils.validateRenderingContext(container, "No location data available for display")) return;

  // Clear container and extract data from state
  container.innerHTML = "";
  const { dataset } = state;
  const geoDim = state.aggregationDefinition.geoDimension?.[0];
  const measure = state.aggregationDefinition.measures[0]?.alias;

  if (!geoDim || !measure) {
    container.innerHTML = "<p>Missing required geographic dimension or measure.</p>";
    return;
  }

  // Process data for visualization
  const points = processLocationData(dataset, geoDim, measure);
  if (points.length === 0) {
    container.innerHTML = "<p>No valid location data available to display.</p>";
    return;
  }

  // Setup and render map
  const width = 1440;
  const height = 720;
  const mapContainer = createMapContainer(container, width, height);
  const map = setupLeafletMap(mapContainer);

  // Add visualization layers
  addHeatLayer(map, points, measure);
  fitMapToPoints(map, points);

  // Setup resize handling
  chartUtils.setupResizeHandler(container, () => renderHeatMap(container));
}

// ===== DATA PROCESSING =====

/**
 * Process raw data into point data with coordinates and values
 * @param {Array} dataset - Raw data records
 * @param {string} geoDim - Name of the geographic dimension
 * @param {string} measure - Name of the measure to visualize
 * @returns {Array} Array of valid points with lat, lng and value
 */
function processLocationData(dataset, geoDim, measure) {
  return dataset.reduce((validPoints, record) => {
    const locationData = record[geoDim];
    if (!locationData || locationData === "Unspecified") return validPoints;

    // Extract coordinates from location data
    const lat = parseFloat(locationData.x);
    const lng = parseFloat(locationData.y);

    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return validPoints;

    // Add valid point to the array with reference information
    validPoints.push({
      lat,
      lng,
      value: +record[measure] || 1,
      borough: record.reference_borough || "Unknown",
      neighborhood: record.reference_neighborhood || "Unknown",
    });

    return validPoints;
  }, []);
}

// ===== MAP SETUP =====

/**
 * Create a container element for the Leaflet map
 * @param {HTMLElement} container - Parent container
 * @param {number} width - Desired width
 * @param {number} height - Desired height
 * @returns {HTMLElement} The new map container
 */
function createMapContainer(container, width, height) {
  // Create wrapper div for map and potential legend
  const wrapperDiv = document.createElement("div");
  wrapperDiv.className = "heat-map-wrapper";
  Object.assign(wrapperDiv.style, {
    width: "100%",
    maxWidth: "100%",
    position: "relative",
    overflow: "hidden",
  });

  // Create the map container with unique ID
  const mapContainer = document.createElement("div");
  mapContainer.id = `leaflet-map-${Date.now()}`;
  Object.assign(mapContainer.style, {
    width: "100%",
    height: `${height}px`,
    boxSizing: "border-box",
  });

  // Append to DOM
  wrapperDiv.appendChild(mapContainer);
  container.appendChild(wrapperDiv);

  return mapContainer;
}

/**
 * Initialize the Leaflet map with appropriate base layer
 * @param {HTMLElement} mapContainer - Container for the map
 * @returns {L.Map} Configured Leaflet map
 */
function setupLeafletMap(mapContainer) {
  // Create map with initial view of US
  const map = L.map(mapContainer.id).setView(US_CENTER, DEFAULT_ZOOM);

  // Add light-colored tile layer
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);

  return map;
}

/**
 * Adjust map viewport to fit all data points
 * @param {L.Map} map - Leaflet map instance
 * @param {Array} points - Array of data points
 */
function fitMapToPoints(map, points) {
  if (!points?.length) return;

  // Calculate bounds from points
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));

  // Calculate the center with offset in one step
  const northBound = bounds.getNorth();
  const southBound = bounds.getSouth();
  const centerLng = bounds.getCenter().lng;

  // Calculate vertical center
  const latitudeHeight = northBound - southBound;
  const offsetLatitude = southBound + latitudeHeight * 0.4; // offset (10% lower)

  // Calculate appropriate zoom level that would show all points
  const paddingTL = [50, 50];
  const paddingBR = [50, 50];

  // Set the view directly to the calculated position
  const zoom = map.getBoundsZoom(bounds, false, paddingTL, paddingBR);
  map.setView([offsetLatitude, centerLng], Math.min(zoom, 17), {
    animate: false, // Prevent animation
  });
}

// ===== VISUALIZATION =====

/**
 * Add heatmap layer to the map using point data
 * @param {L.Map} map - Leaflet map instance
 * @param {Array} points - Array of data points
 * @param {string} measure - Name of the measure being visualized
 */
function addHeatLayer(map, points, measure) {
  // Calculate the maximum value for scaling
  const maxValue = Math.max(...points.map((p) => p.value), 1);

  // Convert points to heatmap format [lat, lng, intensity]
  const heatData = points.map((point) => [point.lat, point.lng, point.value]);

  // Create and add heatmap layer with custom settings
  L.heatLayer(heatData, {
    ...HEAT_SETTINGS,
    max: maxValue * 0.75, // Scale max to 75% for better visual contrast
  }).addTo(map);

  // Add tooltip functionality
  addTooltipFunctionality(map, points, measure);
}

// ===== INTERACTIVITY =====

/**
 * Find the nearest point to a given coordinate
 * @param {L.LatLng} latlng - The mouse position
 * @param {Array} points - Array of data points
 * @returns {Object|null} The closest point and its distance
 */
function findClosestPoint(latlng, points) {
  let minDist = Infinity,
    closest = null;

  points.forEach((p) => {
    const dLat = p.lat - latlng.lat;
    const dLng = p.lng - latlng.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  });

  return closest ? { point: closest, distance: minDist } : null;
}

/**
 * Add tooltip functionality to the map
 * @param {L.Map} map - Leaflet map instance
 * @param {Array} points - Array of data points
 * @param {string} measure - Name of the measure being visualized
 */
function addTooltipFunctionality(map, points, measure) {
  const tooltip = chartStyles.createTooltip();
  let tooltipMarker = null;
  let isTooltipVisible = false;

  map.on("mousemove", (e) => {
    const nearest = findClosestPoint(e.latlng, points);

    if (nearest && nearest.distance < POINT_PROXIMITY_THRESHOLD) {
      // Show tooltip with info
      const { lat, lng, value, borough, neighborhood } = nearest.point;
      const tooltipContent = createTooltipContent(lat, lng, value, measure, borough, neighborhood);

      chartStyles.tooltip.show(tooltip, e.originalEvent, tooltipContent);

      // Show/move marker at the nearest point
      if (!tooltipMarker) {
        tooltipMarker = L.circleMarker([lat, lng], {
          radius: 5,
          color: "#000",
          weight: 1,
          fillOpacity: 0,
        }).addTo(map);
      } else {
        tooltipMarker.setLatLng([lat, lng]);
      }

      isTooltipVisible = true;
    } else if (isTooltipVisible) {
      // Hide tooltip and marker when out of range
      chartStyles.tooltip.hide(tooltip);
      if (tooltipMarker) {
        map.removeLayer(tooltipMarker);
        tooltipMarker = null;
      }
      isTooltipVisible = false;
    }
  });

  // Ensure tooltip hides when mouse leaves map
  map.on("mouseout", () => {
    if (isTooltipVisible) {
      chartStyles.tooltip.hide(tooltip);
      if (tooltipMarker) {
        map.removeLayer(tooltipMarker);
        tooltipMarker = null;
      }
      isTooltipVisible = false;
    }
  });
}

/**
 * Create tooltip content with enhanced location information
 */
function createTooltipContent(lat, lng, value, measure, borough, neighborhood) {
  return chartUtils.createStandardTooltip({
    dimensions: [
      { name: "borough", value: borough },
      { name: "neighborhood_name", value: neighborhood },
      { name: "Location", value: `${lat.toFixed(4)}, ${lng.toFixed(4)}` },
    ],
    measures: [{ name: measure, value: value, field: measure }],
  });
}

export default renderHeatMap;
export { renderHeatMap as renderHeatmap }; // For backwards compatibility
