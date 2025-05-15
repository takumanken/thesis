/**
 * mobile-blocker.js - Blocks mobile devices from accessing ASK NYC application
 * Uses DeviceDetector.js to reliably detect mobile devices
 */

document.addEventListener("DOMContentLoaded", function () {
  // Use DeviceDetector to identify device type
  const deviceDetector = new DeviceDetector();
  const device = deviceDetector.parse(navigator.userAgent);

  // Check window size as a secondary confirmation
  const isMobileSize = window.innerWidth <= 1024;

  // Block access if device is mobile/tablet or screen is mobile-sized
  if ((device.device && (device.device.type === "smartphone" || device.device.type === "tablet")) || isMobileSize) {
    // Create the mobile warning overlay
    createMobileWarning();

    // Hide the application content
    hideApplicationContent();

    // Prevent scrolling
    document.body.style.overflow = "hidden";
  }

  // Create and append the warning overlay
  function createMobileWarning() {
    // Create container
    const warningDiv = document.createElement("div");
    warningDiv.id = "mobile-warning";
    warningDiv.className = "mobile-warning";

    // Create content
    const contentDiv = document.createElement("div");
    contentDiv.className = "mobile-warning-content";

    // Add desktop icon
    const iconDiv = document.createElement("div");
    iconDiv.className = "desktop-icon";
    iconDiv.textContent = "💻";
    contentDiv.appendChild(iconDiv);

    // Add heading
    const heading = document.createElement("h2");
    heading.textContent = "Desktop Only Application";
    contentDiv.appendChild(heading);

    // Add paragraphs
    const messages = ["The application is only designed for desktop use. Please use a desktop computer to access it."];

    messages.forEach((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      contentDiv.appendChild(p);
    });

    // Assemble and add to document
    warningDiv.appendChild(contentDiv);
    document.body.appendChild(warningDiv);

    // Add CSS
    const style = document.createElement("style");
    style.textContent = `
            .mobile-warning {
                display: flex;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.95);
                z-index: 9999;
                justify-content: center;
                align-items: center;
                text-align: center;
            }
            
            .mobile-warning-content {
                background-color: var(--color-primary, #414577);
                padding: 30px 20px;
                border-radius: 10px;
                max-width: 90%;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                color: white;
            }
            
            .desktop-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }
            
            .mobile-warning-content h2 {
                color: white;
                margin-bottom: 20px;
                font-size: 24px;
            }
            
            .mobile-warning-content p {
                margin: 15px 0;
                font-size: 16px;
                line-height: 1.5;
            }
        `;
    document.head.appendChild(style);
  }

  // Hide the application content
  function hideApplicationContent() {
    // Try different selectors to find the main app content
    const selectors = [
      ".app-container",
      ".landing-container",
      ".landing-body",
      ".main-content",
      "main",
      "#app",
      ".app-wrapper",
      ".content-wrapper",
      "#root",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = "none";
        break;
      }
    }
  }
});
