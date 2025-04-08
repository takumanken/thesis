import { state } from "../state.js";

function renderTextResponse(container) {
  // Clear container
  container.innerHTML = "";

  // Create styled container for the text
  const textContainer = document.createElement("div");
  textContainer.className = "text-response";
  textContainer.style.padding = "20px";
  textContainer.style.backgroundColor = "#f8f9fa";
  textContainer.style.border = "1px solid #dee2e6";
  textContainer.style.borderRadius = "5px";
  textContainer.style.fontFamily = "system-ui, -apple-system, sans-serif";
  textContainer.style.lineHeight = "1.5";
  textContainer.style.maxWidth = "100%";
  textContainer.style.overflowWrap = "break-word";

  // Add the text response or a fallback message
  textContainer.innerText = state.textResponse || "No response text available";

  // Append to the main container
  container.appendChild(textContainer);
}

export default renderTextResponse;
