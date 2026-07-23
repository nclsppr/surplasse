import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { fr } from "./i18n/fr";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error(fr.runtime.rootMissing);
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
