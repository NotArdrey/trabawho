import { useState } from "react";
import { createRoot } from "react-dom/client";

import BookingCalendarModal from "@/features/bookings/components/BookingCalendarModal";
import SlotEditModal from "@/features/work/components/SlotEditModal";
import "@/styles/globals.css";

function tomorrowKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Journey() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const date = params.get("date") || tomorrowKey();
  const live = params.has("live");
  const weekLater = params.has("weekLater");
  const nextWeek = new Date(`${date}T00:00:00Z`);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const nextWeekDate = nextWeek.toISOString().slice(0, 10);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const slot = (id: number, hour: string, slotDate = date) => ({ id, start_ts: new Date(`${slotDate}T${hour}:00:00+08:00`).toISOString(),
    end_ts: new Date(`${slotDate}T${String(Number(hour) + 1).padStart(2, "0")}:00:00+08:00`).toISOString() });
  return <main className="space-y-4 p-4">
    <button type="button" onClick={() => setEditorOpen(true)}>Add worker time</button>
    <button type="button" onClick={() => setCalendarOpen(true)}>Open client calendar</button>
    {saved ? <p role="status">Time saved</p> : null}
    {editorOpen ? <SlotEditModal isOpen mode="with-slots" dayLabel="Monday" modalTitle="Add Time Slot"
      existingEntries={[{ id: 1, startTime: "09:00", endTime: "10:00" }]}
      onClose={() => setEditorOpen(false)} onSave={() => { setSaved(true); setEditorOpen(false); return true; }} /> : null}
    <BookingCalendarModal isOpen={calendarOpen} worker={{ id: "provider-1", name: "Test Provider", title: "Cleaning", rawService: live ? { id: 7 } : undefined }}
      schedule={{ manualScheduling: false, operatingDays: [], dayBlocks: {
        [date]: weekLater ? [] : live ? [
          { id: 1, startTime: "09:00", endTime: "10:00", slotsLeft: 1, rawSlot: slot(1, "09") },
          { id: 2, startTime: "10:00", endTime: "11:00", slotsLeft: 1, rawSlot: slot(2, "10") },
        ] : [1, 2].map((id) => ({ id, startTime: "09:00", endTime: "10:00", slotsLeft: 1 })),
        ...(weekLater ? {
          [weekday]: [{ id: 3, startTime: "13:00", endTime: "14:00", slotsLeft: 1, rawSlot: slot(3, "13", nextWeekDate) }],
          [nextWeekDate]: [{ id: 3, startTime: "13:00", endTime: "14:00", slotsLeft: 1, rawSlot: slot(3, "13", nextWeekDate) }],
        } : {}),
      } }} onClose={() => setCalendarOpen(false)} onConfirmBooking={(selection) => {
        document.body.dataset.bookedDate = selection.date;
        document.body.dataset.bookedSlotDate = selection.selectedBlock?.rawSlot?.start_ts?.slice(0, 10);
      }} />
  </main>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Journey />);
