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

  /**
   * Check if device screen size is unsuitable for our app
   * @returns {boolean} true if device should be blocked
   */
  function shouldBlockDevice() {
    const viewportWidth = window.innerWidth;
    return viewportWidth < MIN_VIEWPORT_WIDTH;
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
   * Update DOM based on device compatibility
   */
  function handleDeviceCompatibility() {
    const shouldBlock = shouldBlockDevice();
    const mobileBlocker = document.getElementById("mobile-blocker");
    const contentElements = document.querySelectorAll(".app-main, .app-header, .landing-container");

    // Handle blocker visibility
    if (shouldBlock) {
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

      contentElements.forEach((el) => {
        if (el.classList.contains("landing-container")) {
          el.style.display = "flex";
        } else {
          el.style.display = "block";
        }
      });
    }
  }

  // Initialize and set up resize listener
  handleDeviceCompatibility();
  window.addEventListener("resize", handleDeviceCompatibility);
})();
