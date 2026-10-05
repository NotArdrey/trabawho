import { createRoot } from "react-dom/client";

import { ProviderBookingConflictNotice } from "@/features/bookings/components/ProviderBookingConflictNotice";
import "@/styles/globals.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<main className="mx-auto max-w-4xl p-4">
  <article className="rounded-xl border bg-background p-4">
    <h1 className="text-xl font-semibold">Garden cleanup booking</h1>
    <ProviderBookingConflictNotice conflicts={[{
      bookingId: "other-job", serviceType: "House painting", clientName: "Bea Client",
      startAt: "2026-10-10T01:30:00Z",
    }]} onViewBooking={(id) => { document.body.dataset.openedBooking = id; }} />
  </article>
</main>);
