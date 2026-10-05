import { createRoot } from "react-dom/client";
import { ReplacementVisitActions } from "@/features/bookings/components/ReplacementVisitActions";
import "@/styles/globals.css";

const viewerRole = new URLSearchParams(location.search).get("role") === "client" ? "client" : "provider";
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-3xl p-4">
    <ReplacementVisitActions caseId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
      bookingId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" viewerRole={viewerRole} funded onChanged={() => {}} />
  </main>,
);
