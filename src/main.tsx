import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import { AppProviders } from "@/app/providers/app-providers";
import "@/styles/globals.css";

function normalizeLegacyAuthUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const authType = hashParams.get("type") ?? queryParams.get("type");

  if (window.location.pathname === "/" && authType === "recovery") {
    window.history.replaceState(null, "", `/reset-password${window.location.search}${window.location.hash}`);
  }
}

normalizeLegacyAuthUrl();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The application root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
