/**
 * Heat Map Component
 * Displays geospatial data using a heat/intensity map
 */
import { state } from "../state.js";
import { CHART_DIMENSIONS } from "../constants.js";
import { chartStyles } from "./utils/chartStyles.js";
import { setupResizeHandler, validateRenderingContext } from "./utils/chartUtils.js";

/**
 * Main render function for heat map
 * @param {HTMLElement} container - DOM element to render the chart
 */
function renderHeatMap(container) {
  if (!validateRenderingContext(container, "No location data available for display")) return;

  // Clear container and get configuration
  container.innerHTML = "";
  const { width, height } = CHART_DIMENSIONS;

  // Extract data from state
  const dataset = state.dataset;
  const geoDim = state.aggregationDefinition.geoDimension[0];
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
  addHeatLayer(map, points, measure);
  fitMapToPoints(map, points);

  // Setup resize handling
  setupResizeHandler(container, () => renderHeatMap(container));
}

// ===== DATA PROCESSING =====

/**
 * Process raw data into point data with coordinates and values
 */
function processLocationData(dataset, geoDim, measure) {
  const points = [];

  dataset.forEach((record) => {
    const locationData = record[geoDim];
    if (!locationData || locationData === "Unspecified") return;

    // Extract coordinates from location data
    let lat = parseFloat(locationData.x);
    let lng = parseFloat(locationData.y);

    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

    // Add valid point to the array
    points.push({
      lat,
      lng,
      value: +record[measure] || 1,
    });
  });

  return points;
}

// ===== MAP SETUP =====

/**
 * Create a container element for the Leaflet map
 */
function createMapContainer(container, width, height) {
  // Create wrapper div for map and legend
  const wrapperDiv = document.createElement("div");
  wrapperDiv.className = "heat-map-wrapper";
  wrapperDiv.style.width = "100%";
  wrapperDiv.style.maxWidth = "100%";
  wrapperDiv.style.position = "relative";
  wrapperDiv.style.overflow = "hidden";
  container.appendChild(wrapperDiv);

  // Create the map container with unique ID
  const mapContainer = document.createElement("div");
  mapContainer.id = "leaflet-map-" + Date.now();
  mapContainer.style.width = "100%";
  mapContainer.style.height = `${height}px`;
  mapContainer.style.boxSizing = "border-box";
  wrapperDiv.appendChild(mapContainer);

  return mapContainer;
}

/**
 * Initialize the Leaflet map with appropriate base layer
 */
function setupLeafletMap(mapContainer) {
  // Create map with initial view
  const map = L.map(mapContainer.id).setView([39.8283, -98.5795], 4); // Center of US with zoom level

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
 */
function fitMapToPoints(map, points) {
  if (!points || points.length === 0) return;

  // Create bounds containing all points
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));

  // Fit map to these bounds with padding
  map.fitBounds(bounds, {
    padding: [50, 50],
    maxZoom: 15, // Limit zoom level for better context
  });
}

// ===== VISUALIZATION =====

/**
 * Add heatmap layer to the map using point data
 */
function addHeatLayer(map, points, measure) {
  // Get value range from data points
  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Convert points to heatmap format [lat, lng, intensity]
  const heatData = points.map((point) => {
    // Normalize value to improve visualization
    const normalizedIntensity = point.value;
    return [point.lat, point.lng, normalizedIntensity];
  });

  // Update gradient to match the screenshot (blue-purple-yellow)
  const gradient = {
    0: "navy",
    0.25: "cyan",
    0.5: "yellow",
    0.75: "orange",
    1.0: "red",
  };

  // Create and add heatmap layer with custom settings
  L.heatLayer(heatData, {
    radius: 7.5,
    blur: 5,
    maxZoom: 1,
    gradient: gradient,
    max: maxValue * 0.75,
    minOpacity: 0.3,
  }).addTo(map);

  // Add tooltip functionality
  addTooltipFunctionality(map, points, measure);
}

// ===== INTERACTIVITY =====

/**
 * Find the nearest point (by straight‑line) to a given latlng
 * @param {L.LatLng} latlng  – the mouse event coords
 * @param {Array} points     – array of {lat, lng, value}
 * @returns {{point:Object, distance:number}|null}
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
 */
function addTooltipFunctionality(map, points, measure) {
  // Legacy proximity‑based hover from the original design
  const tooltip = chartStyles.createTooltip();
  let tooltipMarker = null;
  let isTooltipVisible = false;

  map.on("mousemove", (e) => {
    const nearest = findClosestPoint(e.latlng, points);
    if (nearest && nearest.distance < 0.01) {
      // show tooltip at mouse cursor
      chartStyles.tooltip.show(
        tooltip,
        e.originalEvent,
        `<strong>Location:</strong> ${nearest.point.lat.toFixed(4)}, ${nearest.point.lng.toFixed(4)}<br>
         <strong>${measure}:</strong> ${formatValue(nearest.point.value)}`
      );

      // show (or move) a small marker at the point
      if (!tooltipMarker) {
        tooltipMarker = L.circleMarker([nearest.point.lat, nearest.point.lng], {
          radius: 5,
          color: "#000",
          weight: 1,
          fillOpacity: 0,
        }).addTo(map);
      } else {
        tooltipMarker.setLatLng([nearest.point.lat, nearest.point.lng]);
      }
      isTooltipVisible = true;
    } else if (isTooltipVisible) {
      // hide tooltip and marker when out of range
      chartStyles.tooltip.hide(tooltip);
      isTooltipVisible = false;
      map.removeLayer(tooltipMarker);
      tooltipMarker = null;
    }
  });
}

/**
 * Format a value with appropriate units
 */
function formatValue(value) {
  // Format based on value magnitude
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  } else if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  } else if (Number.isInteger(value)) {
    return value.toString();
  } else {
    return value.toFixed(2);
  }
}

export default renderHeatMap;
export { renderHeatMap as renderHeatmap };
