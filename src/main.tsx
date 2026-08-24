import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./animations.css";
import "./fixes.css";
import "./chrome.css";
import "./focus-fix";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
