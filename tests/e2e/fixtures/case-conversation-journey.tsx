import React from "react";
import { createRoot } from "react-dom/client";
import { CaseConversation } from "@/features/bookings/components/CaseConversation";
import "@/styles/globals.css";

const viewerRole = new URLSearchParams(location.search).get("role") === "provider" ? "provider" : "admin";
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-3xl p-4"><CaseConversation caseId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" bookingId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" viewerRole={viewerRole} /></main>);
