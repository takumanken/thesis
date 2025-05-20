/**
 * Footer injector script
 * Adds "About this project" footer to any page that includes this script
 */
(function () {
  function addFooterStyles() {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      /* Footer styling - to work with grid layout */
      #asknycFooter {
        width: 100%;
        height: 30px;
        padding: 0;
        text-align: center;
        font-family: 'Noto Sans', sans-serif;
        color: #555;
        font-size: 0.8rem;
        grid-row: 3;
        display: flex;
        align-items: center;
        z-index: 10;
      }
  
      #asknycFooter .footer-content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
      }
  
      #asknycFooter a {
        color: rgb(115, 117, 152);
        text-decoration: none;
        font-weight: 500;
        margin-right: 1rem;
      }
  
      #asknycFooter a:hover {
        text-decoration: underline;
      }
    
      /* Other modal styles remain unchanged */
      #about-modal, #privacy-modal {
        display: none;
        position: fixed;
        z-index: 10000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        overflow: auto;
      }
  
      #about-modal .modal-content, #privacy-modal .modal-content {
        background-color: white;
        margin: 20% auto;
        padding: 2rem;
        width: 80%;
        max-width: 800px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        font-family: 'Noto Sans', sans-serif;
      }
  
      #about-modal .close-modal, #privacy-modal .close-modal {
        float: right;
        font-size: 1.8rem;
        font-weight: bold;
        cursor: pointer;
      }
  
      #about-modal .close-modal:hover, #privacy-modal .close-modal:hover {
        color: #414577;
      }
  
      #about-modal h2, #privacy-modal h2 {
        color: #414577;
        font-family: 'Outfit', sans-serif;
        margin-top: 0;
        margin-bottom: 1rem;
      }
  
      #about-modal p, #privacy-modal p {
        line-height: 1.6;
        margin-bottom: 1rem;
      }
      `;
    document.head.appendChild(styleEl);
  }

  // Updated create footer function to replace the placeholder
  function createFooter() {
    // Get the placeholder if it exists
    const placeholder = document.getElementById("app-footer-placeholder");

    const footer = document.createElement("footer");
    footer.id = "asknycFooter";
    footer.innerHTML = `
      <div class="footer-content">
        <a href="#" id="about-project-link">About this project</a> <a href="#" id="privacy-notice-link">Privacy Notice</a>
      </div>
    `;

    // Create modals without close buttons
    const aboutModal = document.createElement("div");
    aboutModal.id = "about-modal";
    aboutModal.innerHTML = `
        <div class="modal-content">
          <h2>About ASK NYC</h2>
          <p>ASK NYC is a natural language interface for exploring New York City's 311 service requests.</p>
          <p>This project was developed as part of a 2025 thesis for the M.S. in Data Visualization program at Parsons School of Design.</p>
          <p>This application currently uses the <a href="https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9/about_data" target="_blank">NYC 311 Service Requests dataset</a> from NYC Open Data, covering data from January 2020 through April 2025.</p>
          <p>Created by <a href="https://www.linkedin.com/in/takuhisa-w-b03156193/" target="_blank">Takuhisa Watanabe</a>.</p>
          <p>For more information, please visit the <a href="https://github.com/takumanken/ask-nyc" target="_blank">GitHub repository</a>.</p>
        </div>
      `;

    const privacyModal = document.createElement("div");
    privacyModal.id = "privacy-modal";
    privacyModal.innerHTML = `
            <div class="modal-content">
              <h2>Privacy Notice — May 2025</h2>
              <p>By using ASK NYC you agree that:</p>
              <ul>
                <li>Query text—and, if you enable "Use my NYC location," your coarse latitude/longitude (3-dec ≈ 111 m)—are sent to Google's Gemini API to create a data visualisation. Because this site uses the free Gemini tier, Google may retain prompts and outputs to improve its services (<a href="https://ai.google.dev/terms" target="_blank">see link</a>).</li>
                <li>GitHub Pages (site host) and Railway (API host) automatically log connection metadata such as IP address for security. For more information, visit <a href="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection" target="_blank">GitHub Pages documentation</a> and <a href="https://railway.com/legal/privacy" target="_blank">Railway's privacy policy</a>.</li>
                <li>We also keep brief internal diagnostics logs (timestamp + query/result) purely for troubleshooting; they auto-delete on routine rotation. We never share these logs.</li>
              </ul>
            </div>
          `;

    // If placeholder exists, replace it; otherwise append to body
    if (placeholder) {
      placeholder.parentNode.replaceChild(footer, placeholder);
    } else {
      document.body.appendChild(footer);
    }

    // Append modals to body
    document.body.appendChild(aboutModal);
    document.body.appendChild(privacyModal);
  }

  // Setup modal functionality
  function setupModal() {
    const aboutModal = document.getElementById("about-modal");
    const aboutLink = document.getElementById("about-project-link");
    const privacyModal = document.getElementById("privacy-modal");
    const privacyLink = document.getElementById("privacy-notice-link");

    // About modal functionality
    if (aboutLink && aboutModal) {
      aboutLink.addEventListener("click", function (e) {
        e.preventDefault();
        aboutModal.style.display = "block";
      });
    }

    // Privacy modal functionality
    if (privacyLink && privacyModal) {
      privacyLink.addEventListener("click", function (e) {
        e.preventDefault();
        privacyModal.style.display = "block";
      });
    }

    // Click outside to close
    window.addEventListener("click", function (e) {
      if (e.target === aboutModal) {
        aboutModal.style.display = "none";
      }
      if (e.target === privacyModal) {
        privacyModal.style.display = "none";
      }
    });

    // Prevent clicks inside the modal from closing it
    const modalContents = document.querySelectorAll(".modal-content");
    modalContents.forEach((content) => {
      content.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    });
  }

  // Initialize footer when DOM is loaded
  function init() {
    addFooterStyles();
    createFooter();
    setupModal();
  }

  // Check if DOM is already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
