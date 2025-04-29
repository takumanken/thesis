import { state } from "../state.js";

function renderTextResponse(container) {
  // Clear container
  container.innerHTML = "";

  // Create styled container for the text
  const textContainer = document.createElement("div");
  textContainer.id = "text-response";
  textContainer.style.lineHeight = "1.5";
  textContainer.style.maxWidth = "100%";
  textContainer.style.overflowWrap = "break-word";

  // Add the text response or a fallback message
  textContainer.innerText = state.textResponse || "";

  // Append to the main container
  container.appendChild(textContainer);
}

export default renderTextResponse;
