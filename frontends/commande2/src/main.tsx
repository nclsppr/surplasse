import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import appIconUrl from "../../../brand/surplasse-app-icon.svg";

import { App } from "./app/App";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root is missing from index.html");
}

const appIcon = document.getElementById("app-icon");
if (appIcon instanceof HTMLLinkElement) {
  appIcon.href = appIconUrl;
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
