/**
 * Location services for geolocation features and preferences
 */

// Constants
const LOCATION_STORAGE_KEY = "locationEnabled";

/**
 * Get user coordinates with privacy-conscious precision
 * @returns {Promise<Object>} A promise that resolves to the user's location {latitude, longitude}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    // Check if geolocation is supported by the browser
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    // Get current position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Limit to 3 decimal places (~110m precision) for privacy
        const location = {
          latitude: parseFloat(position.coords.latitude.toFixed(3)),
          longitude: parseFloat(position.coords.longitude.toFixed(3)),
        };
        resolve(location);
      },
      (error) => {
        console.error("Error getting location:", error.message);
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Store user preference for location services
 * @param {boolean} isEnabled - Whether location is enabled
 */
export function saveLocationPreference(isEnabled) {
  localStorage.setItem(LOCATION_STORAGE_KEY, isEnabled.toString());
}

/**
 * Retrieve saved location preference
 * @returns {boolean} Whether location is enabled
 */
export function getLocationPreference() {
  return localStorage.getItem(LOCATION_STORAGE_KEY) === "true";
}

/**
 * Set up location checkbox with stored preference
 * @param {string} checkboxId - ID of the location checkbox element (default: "useLocationCheckbox")
 */
export function initializeLocationCheckbox(checkboxId = "useLocationCheckbox") {
  const checkbox = document.getElementById(checkboxId);
  if (!checkbox) return;

  // Set initial state from storage
  checkbox.checked = getLocationPreference();

  // Add change listener to save preference
  checkbox.addEventListener("change", (e) => {
    saveLocationPreference(e.target.checked);
  });
}
