import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { BookingCardSchedule } from "@/features/bookings/components/BookingCardSchedule";
import { BookingRefundProgress } from "@/features/bookings/components/BookingRefundProgress";
import { BookingReplacementSchedule } from "@/features/bookings/components/BookingReplacementSchedule";
import "@/styles/globals.css";

const bookingId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const caseId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const root = document.getElementById("root");
if (root) createRoot(root).render(<BrowserRouter><main className="mx-auto grid max-w-3xl gap-4 p-4">
  <BookingCardSchedule bookingId={bookingId} checkReplacement originalDate="2026-09-02"
    originalTime="8:08 AM–10:08 AM" paymentMethod="paymongo-card" paymentReference="SHOWCASE-PAID-DE8D36F05202" />
  <BookingReplacementSchedule bookingId={bookingId} />
  <BookingRefundProgress bookingId={bookingId} caseId={caseId} canRequest replacementAccepted demoBooking onChanged={() => {}} />
</main></BrowserRouter>);
