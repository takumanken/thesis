/**
 * Mobile device blocker
 * Prevents usage on screens that are too small to properly display visualizations
 */
(function () {
  // Configuration
  const MIN_VIEWPORT_WIDTH = 900;
  const STYLES = {
    blocker: {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100vh",
      backgroundColor: "#F3F4F8",
      zIndex: "9999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      width: "90%",
      maxWidth: "450px",
      textAlign: "center",
      padding: "30px 0",
    },
    message: {
      padding: "1rem",
    },
    heading: {
      fontSize: "1.8rem",
      marginBottom: "1.5rem",
      color: "#414577",
      fontFamily: "'Outfit', sans-serif",
      fontWeight: "600",
    },
    paragraph: {
      fontFamily: "'Outfit', sans-serif",
      marginBottom: "0.8rem",
      color: "#555",
      fontSize: "1.1rem",
    },
  };

  // Store original element styles to restore later
  const originalStyles = new Map();

  /**
   * Check if device screen size is unsuitable for our app
   * @returns {boolean} true if device should be blocked
   */
  function shouldBlockDevice() {
    const deviceWidth = screen.width;
    return deviceWidth < MIN_VIEWPORT_WIDTH;
  }

  /**
   * Create the blocker element and inject it into the DOM
   */
  function createBlocker() {
    // Create and style main element
    const mobileBlocker = document.createElement("div");
    mobileBlocker.id = "mobile-blocker";
    Object.assign(mobileBlocker.style, STYLES.blocker);

    // Add content
    mobileBlocker.innerHTML = `
          <div class="mobile-blocker-content">
            <div class="mobile-message">
              <h3>Larger Screen Required</h3>
              <p>We're sorry, but ASK NYC is not available in your current environment.</p>
              <p>Please try using a device with a larger screen, such as a desktop or laptop.</p>
            </div>
          </div>
        `;
    document.body.appendChild(mobileBlocker);

    // Apply styles to elements
    const content = mobileBlocker.querySelector(".mobile-blocker-content");
    const message = mobileBlocker.querySelector(".mobile-message");
    const heading = mobileBlocker.querySelector(".mobile-message h3");
    const paragraphs = mobileBlocker.querySelectorAll(".mobile-message p");

    Object.assign(content.style, STYLES.content);
    Object.assign(message.style, STYLES.message);
    Object.assign(heading.style, STYLES.heading);
    paragraphs.forEach((p) => Object.assign(p.style, STYLES.paragraph));
  }

  /**
   * Save original element styles before changing them
   * @param {Element} element - DOM element to save style for
   */
  function saveOriginalStyle(element) {
    if (!originalStyles.has(element)) {
      originalStyles.set(element, element.style.display);
    }
  }

  /**
   * Restore original element styles
   * @param {Element} element - DOM element to restore style for
   */
  function restoreOriginalStyle(element) {
    if (originalStyles.has(element)) {
      element.style.display = originalStyles.get(element);
    } else {
      // If we don't have a saved style, just remove the inline style
      element.style.display = "";
    }
  }

  /**
   * Update DOM based on device compatibility
   */
  function handleDeviceCompatibility() {
    const shouldBlock = shouldBlockDevice();
    const mobileBlocker = document.getElementById("mobile-blocker");
    const contentElements = document.querySelectorAll(".app-main, .app-header, .landing-container");

    // Handle blocker visibility
    if (shouldBlock) {
      // Save original styles before changing them
      contentElements.forEach(saveOriginalStyle);

      if (!mobileBlocker) {
        createBlocker();
      } else {
        mobileBlocker.style.display = "flex";
      }

      // Hide all regular content
      contentElements.forEach((el) => {
        el.style.display = "none";
      });
    } else {
      // Show appropriate content, hide blocker
      if (mobileBlocker) {
        mobileBlocker.style.display = "none";
      }

      // Restore original styles instead of setting arbitrary styles
      contentElements.forEach(restoreOriginalStyle);
    }
  }

  // Only run if we need to block or on resize
  if (shouldBlockDevice()) {
    handleDeviceCompatibility();
  }

  // Add resize listener
  window.addEventListener("resize", handleDeviceCompatibility);
})();
