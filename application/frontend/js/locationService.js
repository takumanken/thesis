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
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        // Log the location data as requested
        console.log("User location:", location);

        resolve(location);
      },
      (error) => {
        console.error("Error getting location:", error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}
