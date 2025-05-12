/**
 * Location service to handle geolocation functionality across all pages
 */

// Constants
const LOCATION_STORAGE_KEY = "locationEnabled";

/**
 * Get the user's current position using the Geolocation API
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
        // Limit precision to 3 decimal places (approximately 110m precision)
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
 * Save the location permission preference
 * @param {boolean} isEnabled - Whether location is enabled
 */
export function saveLocationPreference(isEnabled) {
  localStorage.setItem(LOCATION_STORAGE_KEY, isEnabled.toString());
}

/**
 * Get the current location permission preference
 * @returns {boolean} Whether location is enabled
 */
export function getLocationPreference() {
  return localStorage.getItem(LOCATION_STORAGE_KEY) === "true";
}

/**
 * Initialize location checkbox on any page
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
