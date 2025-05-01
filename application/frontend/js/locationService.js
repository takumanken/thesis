/**
 * Location service to handle geolocation functionality
 */

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
