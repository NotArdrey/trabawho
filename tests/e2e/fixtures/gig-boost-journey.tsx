import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GigBoostPanel } from "@/features/profile/components/GigBoostPanel";
import "@/styles/globals.css";

declare global { interface Window { boostJourneyRoot?: Root } }
const root = document.getElementById("root");
if (root) {
  window.boostJourneyRoot ??= createRoot(root);
  window.boostJourneyRoot.render(<BrowserRouter><main className="mx-auto max-w-5xl p-4"><GigBoostPanel sellerId="sandbox-seller" /></main></BrowserRouter>);
}
