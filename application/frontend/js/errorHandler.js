/**
 * Error handling functionality for the application
 */

// Display generic error message
export function showError() {
  const message = "ASK NYC is facing temporary error, please try again later.";
  showErrorMessage(message);
}

// Display rate limit error message
export function showRateLimitError() {
  const message = "We've reached our query limit. Please try again later.";
  showErrorMessage(message);
}

// Create and display error message with retry button
function showErrorMessage(message) {
  const dashboardPanel = document.querySelector(".dashboard-panel");
  if (!dashboardPanel) return;

  // Clear any existing error messages
  clearErrors();

  // Create error container
  const errorElement = createErrorElement(message);

  // Hide existing dashboard content
  toggleDashboardContent(dashboardPanel, false);

  // Add error message to dashboard
  dashboardPanel.appendChild(errorElement);
}

// Create error message element with styling and retry button
function createErrorElement(message) {
  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.style.cssText = `
    width: 100%;
    text-align: center;
    padding: 24px 16px;
    font-family: "Outfit", sans-serif;
    font-size: 20px;
    color: #333;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    background: white;
    z-index: 100;
  `;

  // Create message paragraph
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  paragraph.style.marginBottom = "16px";

  // Create retry button
  const button = createRetryButton();

  errorElement.appendChild(paragraph);
  errorElement.appendChild(button);

  return errorElement;
}

// Create styled retry button with click handler
function createRetryButton() {
  const button = document.createElement("button");
  button.id = "clearErrorBtn";
  button.textContent = "Try Again";
  button.style.cssText = `
    background-color: var(--color-primary);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    margin-top: 16px;
    cursor: pointer;
    font-family: "Outfit", sans-serif;
    font-size: 14px;
  `;

  // Add click handler to retry
  button.addEventListener("click", handleRetry);

  return button;
}

// Handle retry button click
function handleRetry() {
  const dashboardPanel = document.querySelector(".dashboard-panel");
  if (!dashboardPanel) return;

  // Remove error message
  clearErrors();

  // Show hidden dashboard content
  toggleDashboardContent(dashboardPanel, true);

  // Execute query if available
  const promptInput = document.getElementById("promptInput");
  if (promptInput && promptInput.value) {
    window.handleUserQuery(promptInput.value);
  }
}

// Toggle visibility of dashboard panel children
function toggleDashboardContent(dashboardPanel, show) {
  Array.from(dashboardPanel.children).forEach((child) => {
    child.style.display = show ? "" : "none";
  });
}

// Remove any error messages
export function clearErrors() {
  const errorElement = document.querySelector(".error-message");
  if (errorElement) {
    errorElement.remove();
  }
}
