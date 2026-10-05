import { createRoot } from "react-dom/client";

import BookingCalendarModal from "@/features/bookings/components/BookingCalendarModal";
import "@/styles/globals.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<BookingCalendarModal isOpen worker={{ id: "provider-1", name: "Nina Flores" }}
  schedule={{ manualScheduling: false, operatingDays: ["Mon", "Tue"], dayBlocks: {
    "2026-10-05": [{ id: "today", startTime: "18:00", endTime: "19:00", slotsLeft: 1 }],
    "2026-10-06": [{ id: "tomorrow", startTime: "09:00", endTime: "10:00", slotsLeft: 1 }],
  } }} onClose={() => {}} onConfirmBooking={(selection) => { document.body.dataset.bookedDate = selection.date; }} />);
