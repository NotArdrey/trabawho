import { CalendarDays, Clock3, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface SlotData {
  capacity?: number | string;
  date?: string;
  endTime?: string;
  maxBookings?: number | string;
  note?: string;
  startTime?: string;
}

interface SlotEditModalProps {
  appTheme?: string;
  dayLabel?: string;
  isOpen: boolean;
  modalTitle?: string;
  mode: string;
  onClose: () => void;
  onSave: (slot: SlotData) => void | Promise<unknown>;
  slotData?: SlotData | null;
  submitLabel?: string;
}

const formatTime = (value: string) => {
  if (!value) return "";
  const [hourValue, minute = "00"] = value.split(":");
  const hour = Number(hourValue);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${suffix}`;
};

function SlotEditModal({
  isOpen,
  mode,
  slotData,
  dayLabel,
  modalTitle,
  submitLabel,
  onSave,
  onClose,
}: SlotEditModalProps) {
  const isCalendarMode = mode === "calendar-only";
  const [startTime, setStartTime] = useState(slotData?.startTime || "09:00");
  const [endTime, setEndTime] = useState(slotData?.endTime || "11:00");
  const [capacity, setCapacity] = useState(String(slotData?.capacity || 3));
  const [date, setDate] = useState(slotData?.date || "");
  const [maxBookings, setMaxBookings] = useState(String(slotData?.maxBookings || 3));
  const [note, setNote] = useState(slotData?.note || "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setError("");

    if (isCalendarMode) {
      if (!date.trim()) {
        setError("Choose an available date.");
        return;
      }
      if (!maxBookings.trim() || Number(maxBookings) < 1) {
        setError("Maximum bookings must be at least one.");
        return;
      }
    } else {
      if (!startTime || !endTime) {
        setError("Choose both a start and end time.");
        return;
      }
      if (endTime <= startTime) {
        setError("End time must be later than start time.");
        return;
      }
      if (!capacity.trim() || Number(capacity) < 1) {
        setError("Capacity must be at least one.");
        return;
      }
    }

    try {
      setIsSaving(true);
      await onSave(isCalendarMode
        ? { date, maxBookings: Number(maxBookings), note: note.trim() }
        : { startTime, endTime, capacity: Number(capacity) });
    } finally {
      setIsSaving(false);
    }
  };

  const resolvedTitle = modalTitle || (isCalendarMode ? "Edit available date" : `Edit time slot · ${dayLabel}`);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DialogHeader className="px-6 pb-5 pt-6">
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>
            {isCalendarMode ? "Choose when clients can request this service." : `Set the booking window and capacity for ${dayLabel || "this day"}.`}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-5 px-6 py-5">
          {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{error}</p> : null}

          {isCalendarMode ? (
            <>
              <div className="space-y-2"><Label htmlFor="edit-date">Available date</Label><Input id="edit-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="edit-max-bookings">Maximum bookings</Label><Input id="edit-max-bookings" type="number" min="1" inputMode="numeric" value={maxBookings} onChange={(event) => setMaxBookings(event.target.value)} /><p className="text-xs text-muted-foreground">Maximum number of clients you can accept on this date.</p></div>
              <div className="space-y-2"><Label htmlFor="edit-note">Provider note <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="edit-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Morning appointments only" /></div>
              {date ? <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-4"><CalendarDays className="size-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-sm font-semibold">{new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><p className="text-xs text-muted-foreground">Up to {maxBookings || 0} bookings</p></div></div> : null}
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="edit-start">Start time</Label><Input id="edit-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="edit-end">End time</Label><Input id="edit-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="edit-capacity">Slot capacity</Label><Input id="edit-capacity" type="number" min="1" inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value)} /><p className="text-xs text-muted-foreground">Number of clients who can book during this time.</p></div>
              {startTime && endTime ? <div className="grid gap-3 rounded-lg bg-primary/5 p-4 sm:grid-cols-2"><div className="flex items-center gap-3"><Clock3 className="size-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-xs text-muted-foreground">Time window</p><p className="text-sm font-semibold">{formatTime(startTime)}–{formatTime(endTime)}</p></div></div><div className="flex items-center gap-3"><Users className="size-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-xs text-muted-foreground">Capacity</p><p className="text-sm font-semibold">{capacity || 0} {capacity === "1" ? "client" : "clients"}</p></div></div></div> : null}
            </>
          )}
        </div>

        <DialogFooter className="px-6 pb-5 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="button" onClick={() => void handleSave()} isLoading={isSaving}>{isSaving ? "Saving…" : submitLabel || "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SlotEditModal;
