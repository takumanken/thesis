/**
 * Location features with privacy-conscious implementation
 */

// Constants
const LOCATION_STORAGE_KEY = "locationEnabled";

// Gets approximate location (110m precision) to balance usability with privacy
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Reduced precision for privacy (3 decimal places ≈ 110m)
        const location = {
          latitude: parseFloat(position.coords.latitude.toFixed(3)),
          longitude: parseFloat(position.coords.longitude.toFixed(3)),
        };
        resolve(location);
      },
      (error) => reject(error),
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

// Persists user choice about location sharing
export function saveLocationPreference(isEnabled) {
  localStorage.setItem(LOCATION_STORAGE_KEY, isEnabled.toString());
}

// Retrieves user's saved location preference
export function getLocationPreference() {
  return localStorage.getItem(LOCATION_STORAGE_KEY) === "true";
}

// Connects UI checkbox with stored preference
export function initializeLocationCheckbox(checkboxId = "useLocationCheckbox") {
  const checkbox = document.getElementById(checkboxId);
  if (!checkbox) return;

  checkbox.checked = getLocationPreference();

  checkbox.addEventListener("change", (e) => {
    saveLocationPreference(e.target.checked);
  });
}
