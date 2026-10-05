import { createRoot } from "react-dom/client";

import { BookingCardFooter } from "@/features/bookings/components/BookingCardFooter";
import { BookingTransactionActions } from "@/features/bookings/components/BookingTransactionActions";
import type { BookingActionRecord } from "@/features/bookings/types/booking-action-record";
import "@/styles/globals.css";

const soon = new URLSearchParams(window.location.search).has("soon");
const booking: BookingActionRecord = {
  id: "test-booking",
  paymentStatus: "paid",
  scheduleStatus: "confirmed",
  deliveryStatus: "not_delivered",
  disputeStatus: "none",
  appointmentStartAt: new Date(Date.now() + (soon ? 20 : 120) * 60_000).toISOString(),
  raw: { booking: { status: "confirmed" } },
};

createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-5xl p-4 sm:p-6">
    <BookingCardFooter amountLabel="Booking amount" amount="PHP 900" messageLabel="Message client"
      messageIsPrimary onViewDetails={() => {}} onMessage={() => {}}>
      <BookingTransactionActions booking={booking} viewerRole="provider" onUpdated={() => {}} />
    </BookingCardFooter>
  </main>,
);
