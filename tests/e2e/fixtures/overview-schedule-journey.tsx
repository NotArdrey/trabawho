import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Dashboard from "@/features/dashboard/pages/Dashboard";
import WorkerDashboard from "@/features/work/pages/WorkerDashboard";
import "@/styles/globals.css";
import "@/shared/styles/modern.css";

const isProvider = new URLSearchParams(window.location.search).get("mode") === "provider";
const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter>{isProvider
  ? <WorkerDashboard sellerProfile={{ userId: "provider-1", role: "worker" }} />
  : <Dashboard sellerProfile={{ userId: "client-1", role: "client", firstName: "Kuh" }} />
}</BrowserRouter>);
