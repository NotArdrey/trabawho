import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isBookableClientAppointment, isFutureClientBookingDate, philippineDateKey } from "@/shared/domain/clientBookingDate";
import {
  fetchPublicServiceSlots,
  type AvailableServiceSlot,
} from "@/features/bookings/services/bookingAvailability";

interface BookingSummary {
  id?: number | string;
  quoteAmount?: number | string;
  serviceId?: number | string;
  serviceType?: string;
  workerName?: string;
}

interface SelectedSlot {
  blockId: number;
  date: string;
  dateKey: string;
  dayKey: string;
  dayName: string;
  displayDate: string;
  endTs: string;
  rawSlot: AvailableServiceSlot;
  slotId: number;
  startTs: string;
  timeBlock: {
    capacity: number;
    endTime: string;
    id: number;
    rawSlot: AvailableServiceSlot;
    slotsLeft: number;
    startTime: string;
  };
}

interface SlotSelectionModalProps {
  action?: "checkout" | "reschedule";
  booking: BookingSummary;
  onCancel: () => void;
  onConfirmSlot: (slot: SelectedSlot) => Promise<void> | void;
}

const dateKey = (value: string | Date) => {
  return philippineDateKey(value) || "";
};

const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
  day: "numeric",
  month: "short",
  weekday: "short",
});

const timeLabel = (value: string) => new Date(value).toLocaleTimeString("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

const DATES_PER_PAGE = 6;

export default function SlotSelectionModal({ action = "checkout", booking, onCancel, onConfirmSlot }: SlotSelectionModalProps) {
  const [slots, setSlots] = useState<AvailableServiceSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [datePage, setDatePage] = useState(0);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const timesHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const refreshClock = () => {
      const next = new Date();
      setNow(next);
      if (selectedDate && !isFutureClientBookingDate(selectedDate, next)) {
        setSelectedDate(""); setSelectedSlotId(null); setIsReviewing(false);
        setError("That date is no longer bookable. Choose a date from tomorrow onward (PHT).");
      }
    };
    const timer = window.setInterval(refreshClock, 30_000);
    window.addEventListener("focus", refreshClock);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshClock); };
  }, [selectedDate]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!booking.serviceId) {
        setError("This booking is missing its service information.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const result = await fetchPublicServiceSlots(booking.serviceId);
        if (active) setSlots(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load available times.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [booking.serviceId]);

  const bookableSlots = useMemo(() => slots.filter((slot) => isBookableClientAppointment(slot.start_ts, slot.end_ts, now)), [slots, now]);
  const groupedSlots = useMemo(() => bookableSlots.reduce<Record<string, AvailableServiceSlot[]>>((result, slot) => {
    const key = dateKey(slot.start_ts);
    (result[key] ??= []).push(slot);
    return result;
  }, {}), [bookableSlots]);
  const dates = Object.keys(groupedSlots).sort();
  const pageCount = Math.ceil(dates.length / DATES_PER_PAGE);
  const currentPage = Math.min(datePage, Math.max(0, pageCount - 1));
  const visibleDates = dates.slice(currentPage * DATES_PER_PAGE, (currentPage + 1) * DATES_PER_PAGE);
  const dateSlots = selectedDate ? groupedSlots[selectedDate] ?? [] : [];
  const selectedSlot = bookableSlots.find((slot) => slot.id === selectedSlotId);

  const chooseDate = (value: string) => {
    if (!groupedSlots[value] || !isFutureClientBookingDate(value)) {
      setError("Choose a date from tomorrow onward (PHT).");
      return;
    }
    setIsReviewing(false);
    setSubmitError("");
    setSelectedDate(value);
    setSelectedSlotId(null);
    setError("");
    window.setTimeout(() => timesHeadingRef.current?.focus(), 0);
  };

  const changeDatePage = (nextPage: number) => {
    setIsReviewing(false);
    setSubmitError("");
    setDatePage(nextPage);
    setSelectedDate("");
    setSelectedSlotId(null);
    setError("");
  };

  const confirm = async () => {
    if (isSubmitting) return;
    if (!selectedSlot || !isBookableClientAppointment(selectedSlot.start_ts, selectedSlot.end_ts)) {
      setSubmitError("That time is no longer bookable. Choose a date from tomorrow onward (PHT).");
      return;
    }
    const key = dateKey(selectedSlot.start_ts);
    const startTime = timeLabel(selectedSlot.start_ts);
    const endTime = timeLabel(selectedSlot.end_ts);
    const dayName = new Date(`${key}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short" });
    const selection: SelectedSlot = {
      blockId: selectedSlot.id,
      date: key,
      dateKey: key,
      dayKey: dayName,
      dayName,
      displayDate: dateLabel(key),
      endTs: selectedSlot.end_ts,
      rawSlot: selectedSlot,
      slotId: selectedSlot.id,
      startTs: selectedSlot.start_ts,
      timeBlock: {
        capacity: selectedSlot.capacity,
        endTime,
        id: selectedSlot.id,
        rawSlot: selectedSlot,
        slotsLeft: Math.max(0, selectedSlot.capacity - selectedSlot.booked_count),
        startTime,
      },
    };
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const fresh = await fetchPublicServiceSlots(booking.serviceId!);
      const available = fresh.find((slot) => slot.id === selectedSlot.id
        && slot.start_ts === selectedSlot.start_ts && slot.end_ts === selectedSlot.end_ts);
      if (!available) {
        setSlots(fresh); setSelectedSlotId(null); setIsReviewing(false);
        setSubmitError("That time was just booked or changed. Choose another available time.");
        return;
      }
      await onConfirmSlot(selection);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Unable to continue with this booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const review = async () => {
    if (!selectedSlot || !isBookableClientAppointment(selectedSlot.start_ts, selectedSlot.end_ts)) {
      setSelectedDate(""); setSelectedSlotId(null);
      setError("That time is no longer bookable. Choose a date from tomorrow onward (PHT).");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const fresh = await fetchPublicServiceSlots(booking.serviceId!);
      const available = fresh.find((slot) => slot.id === selectedSlot.id
        && slot.start_ts === selectedSlot.start_ts && slot.end_ts === selectedSlot.end_ts);
      setSlots(fresh);
      if (!available) {
        setSelectedSlotId(null);
        setSubmitError("That time was just booked or changed. Choose another available time.");
        return;
      }
      setIsReviewing(true);
    } catch {
      setSubmitError("Could not check the provider's latest availability. Please try again.");
    } finally { setIsSubmitting(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="flex max-h-[100dvh] w-full max-w-3xl flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-h-[92dvh] sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b bg-muted/35 px-5 py-5 pr-14 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" aria-hidden="true" /></span>
            <div>
              <DialogTitle>{isReviewing ? "Review your booking" : "Choose a booking schedule"}</DialogTitle>
              <DialogDescription className="mt-1">{isReviewing ? action === "reschedule" ? "Check the new time before requesting a schedule change." : "Check the service and appointment before continuing to payment terms." : `Select a date, then choose an exact time with ${booking.workerName || "this provider"}.`}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {isReviewing && selectedSlot ? (
            <section aria-label="Booking review" className="space-y-4">
              <div className="rounded-xl border bg-background p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service</p>
                <h3 className="mt-1 text-lg font-bold text-foreground">{booking.serviceType || "Booked service"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">With {booking.workerName || "your provider"}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appointment</p>
                  <p className="mt-2 font-semibold text-foreground">{dateLabel(dateKey(selectedSlot.start_ts))}</p>
                  <p className="text-sm text-muted-foreground">{timeLabel(selectedSlot.start_ts)}–{timeLabel(selectedSlot.end_ts)}</p>
                </div>
                {Number(booking.quoteAmount) > 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service price</p>
                    <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-400">PHP {Number(booking.quoteAmount).toLocaleString("en-PH")}</p>
                    <p className="text-xs text-muted-foreground">Any platform fee is shown at checkout.</p>
                  </div>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{action === "reschedule" ? "Your current booking time stays in place until the change is processed." : "Your time is not reserved yet. You can still change the schedule before continuing."}</p>
            </section>
          ) : isLoading ? (
            <div className="flex min-h-56 items-center justify-center gap-3 text-muted-foreground" role="status"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Loading available times…</div>
          ) : dates.length === 0 ? (
            <div className="rounded-xl bg-muted/55 p-6 text-center"><p className="font-semibold text-foreground">No times are available right now</p><p className="mt-1 text-sm text-muted-foreground">Bookings start tomorrow (PHT). Close this window and message the provider to coordinate another schedule.</p></div>
          ) : (
            <div className="space-y-6">
              <section aria-labelledby="booking-date-heading">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 id="booking-date-heading" className="font-semibold text-foreground">1. Choose a date</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Dates start tomorrow, Philippine time.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Showing {currentPage * DATES_PER_PAGE + 1}–{Math.min((currentPage + 1) * DATES_PER_PAGE, dates.length)} of {dates.length} available dates</p>
                  </div>
                  {pageCount > 1 ? <div className="flex items-center gap-2" aria-label="Available date pages">
                    <Button type="button" variant="outline" size="icon" aria-label="Previous dates" disabled={currentPage === 0} onClick={() => changeDatePage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button>
                    <span className="min-w-12 text-center text-sm tabular-nums text-muted-foreground">{currentPage + 1} / {pageCount}</span>
                    <Button type="button" variant="outline" size="icon" aria-label="Next dates" disabled={currentPage === pageCount - 1} onClick={() => changeDatePage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button>
                  </div> : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {visibleDates.map((value) => {
                    const available = groupedSlots[value].reduce((count, slot) => count + Math.max(0, slot.capacity - slot.booked_count), 0);
                    const selected = value === selectedDate;
                    return <button key={value} type="button" aria-pressed={selected} onClick={() => chooseDate(value)} className={cn("min-h-16 rounded-lg border border-border bg-background px-3 py-2 text-left outline-none transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring", selected && "border-primary bg-primary text-primary-foreground hover:bg-primary")}><span className="block font-semibold">{dateLabel(value)}</span><span className={cn("text-xs text-muted-foreground", selected && "text-primary-foreground/80")}>{available} {available === 1 ? "spot" : "spots"} left</span></button>;
                  })}
                </div>
              </section>

              <section aria-labelledby="booking-time-heading" className="border-t border-border pt-5">
                <h3 id="booking-time-heading" ref={timesHeadingRef} tabIndex={-1} className="font-semibold text-foreground outline-none">2. Choose a time</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedDate ? `Available times on ${dateLabel(selectedDate)}` : "Select a date above to see its times."}</p>
                {selectedDate ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {dateSlots.map((slot) => {
                    const available = Math.max(0, slot.capacity - slot.booked_count);
                    const selected = slot.id === selectedSlotId;
                    return <button key={slot.id} type="button" disabled={available === 0} aria-pressed={selected} onClick={() => { if (!isBookableClientAppointment(slot.start_ts, slot.end_ts)) { setError("That time is no longer bookable. Choose a date from tomorrow onward (PHT)."); return; } setSelectedSlotId(slot.id); setError(""); }} className={cn("flex min-h-16 items-center justify-between rounded-xl bg-muted/45 px-4 text-left outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", selected && "bg-primary text-primary-foreground hover:bg-primary")}><span><span className="flex items-center gap-2 font-semibold"><Clock3 className="size-4" aria-hidden="true" />{timeLabel(slot.start_ts)}–{timeLabel(slot.end_ts)}</span><span className={cn("mt-1 block text-xs text-muted-foreground", selected && "text-primary-foreground/80")}>{available} {available === 1 ? "spot" : "spots"} left</span></span>{selected ? <Check className="size-5" aria-hidden="true" /> : null}</button>;
                  })}
                </div> : null}
              </section>
            </div>
          )}
          {error || submitError ? <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive" role="alert">{submitError || error}</p> : null}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground">{selectedSlot ? `${dateLabel(dateKey(selectedSlot.start_ts))}, ${timeLabel(selectedSlot.start_ts)}–${timeLabel(selectedSlot.end_ts)}` : "Select a date and time to continue."}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={isReviewing ? () => setIsReviewing(false) : onCancel}>{isReviewing ? "Change time" : "Cancel"}</Button>
            <Button type="button" disabled={!selectedSlot || isSubmitting} onClick={() => { void (isReviewing ? confirm() : review()); }}>{isSubmitting ? "Updating schedule…" : isReviewing ? action === "reschedule" ? "Request reschedule" : "Continue to terms" : "Review booking"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
