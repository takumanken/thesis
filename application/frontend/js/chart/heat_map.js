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
 * Add tooltip functionality to the map
 */
function addTooltipFunctionality(map, points, measure) {
  if (!points || points.length === 0) return;

  // Create tooltip element
  const tooltip = chartStyles.createTooltip();

  // Keep track of tooltip state
  let isTooltipVisible = false;
  let tooltipMarker = null;

  // Add event listener for mouse movement
  map.on("mousemove", (e) => {
    // Find the closest point to mouse position
    const closestPoint = findClosestPoint(e.latlng, points);

    // Use a smaller threshold for precise point detection (approx 1km)
    const proximityThreshold = 0.01;

    if (closestPoint && closestPoint.distance < proximityThreshold) {
      // Show tooltip with point information
      showPointTooltip(e.originalEvent, closestPoint.point, measure, tooltip);
      isTooltipVisible = true;

      // Add or update marker at the point location
      if (!tooltipMarker) {
        tooltipMarker = L.circleMarker([closestPoint.point.lat, closestPoint.point.lng], {
          radius: 4,
          color: "#333",
          weight: 1,
          fillColor: "#fff",
          fillOpacity: 0.8,
        }).addTo(map);
      } else {
        tooltipMarker.setLatLng([closestPoint.point.lat, closestPoint.point.lng]);
      }
    } else if (isTooltipVisible) {
      // Hide tooltip when not near a point
      chartStyles.tooltip.hide(tooltip);
      isTooltipVisible = false;

      // Remove marker when moving away
      if (tooltipMarker) {
        map.removeLayer(tooltipMarker);
        tooltipMarker = null;
      }
    }
  });

  // Handle mouse leaving the map
  map.on("mouseout", () => {
    chartStyles.tooltip.hide(tooltip);
    isTooltipVisible = false;

    // Clean up marker
    if (tooltipMarker) {
      map.removeLayer(tooltipMarker);
      tooltipMarker = null;
    }
  });
}

/**
 * Find the closest data point to a given location
 */
function findClosestPoint(latlng, points) {
  if (!points || points.length === 0) return null;

  let closestPoint = null;
  let closestDistance = Infinity;

  points.forEach((point) => {
    // Calculate distance between points accounting for longitude distortion
    const distance = Math.sqrt(
      Math.pow(point.lat - latlng.lat, 2) +
        Math.pow((point.lng - latlng.lng) * Math.cos((Math.PI * latlng.lat) / 180), 2)
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = point;
    }
  });

  return {
    point: closestPoint,
    distance: closestDistance,
  };
}

/**
 * Show tooltip with information about a specific point
 */
function showPointTooltip(event, point, measure, tooltip) {
  // Format coordinates with 4 decimal places (approx. 10m precision)
  const lat = point.lat.toFixed(4);
  const lng = point.lng.toFixed(4);

  // Create tooltip content
  const content = `
    <strong>Location:</strong> ${lat}, ${lng}<br>
    <strong>${measure}:</strong> ${formatValue(point.value)}
  `;

  // Show tooltip
  chartStyles.tooltip.show(tooltip, event, content);
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
