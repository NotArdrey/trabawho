import { useRef, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquareText,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

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

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface ScheduleBlock {
  id: string;
  startTime: string;
  endTime: string;
  slotsLeft: number;
}

interface BookingSchedule {
  dayBlocks?: Record<string, ScheduleBlock[]>;
  manualScheduling?: boolean;
  operatingDays?: string[];
}

interface BookingWorker {
  id: string;
  name?: string;
  title?: string;
  [key: string]: unknown;
}

interface ConfirmedBooking {
  workerId: string;
  date: string;
  dayKey: string | null;
  blockId: string;
  manualScheduling?: boolean;
}

interface BookingCalendarModalProps {
  isOpen: boolean;
  onClose?: () => void;
  worker: BookingWorker | null;
  schedule: BookingSchedule | null;
  onConfirmBooking: (booking: ConfirmedBooking) => void;
}

interface DateMeta {
  canBookDate: boolean;
  slotCount: number;
  isOperatingDay: boolean;
  dayBlocks: ScheduleBlock[];
  manualScheduling?: boolean;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthHeading(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatLongDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatTime(time24: string) {
  const [hourString, minute] = time24.split(":");
  const hour = Number(hourString);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${suffix}`;
}

function getMonthCells(monthDate: Date) {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstGridDate = new Date(startOfMonth);
  firstGridDate.setDate(startOfMonth.getDate() - startOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate);
    date.setDate(firstGridDate.getDate() + index);
    return { date, isCurrentMonth: date.getMonth() === monthDate.getMonth() };
  });
}

function getDayKeyFromDate(dateString: string) {
  if (!dateString) return null;
  return DAY_KEYS[new Date(`${dateString}T00:00:00`).getDay()];
}

function getDateMeta(schedule: BookingSchedule, dateValue: string): DateMeta {
  if (!dateValue) return { canBookDate: false, slotCount: 0, isOperatingDay: false, dayBlocks: [] };

  const exactBlocks = schedule.dayBlocks?.[dateValue];
  if (exactBlocks) {
    const slotCount = exactBlocks.reduce((sum, block) => sum + Math.max(0, block.slotsLeft || 0), 0);
    return {
      canBookDate: slotCount > 0 || Boolean(schedule.manualScheduling),
      slotCount: slotCount || (schedule.manualScheduling ? 1 : 0),
      isOperatingDay: true,
      dayBlocks: exactBlocks,
      manualScheduling: schedule.manualScheduling,
    };
  }

  const dayKey = getDayKeyFromDate(dateValue);
  const isOperatingDay = Boolean(dayKey && (schedule.operatingDays || []).includes(dayKey));
  const dayBlocks = dayKey && isOperatingDay ? schedule.dayBlocks?.[dayKey] || [] : [];
  if (!isOperatingDay) return { canBookDate: false, slotCount: 0, isOperatingDay, dayBlocks };
  if (schedule.manualScheduling) return { canBookDate: true, slotCount: 1, isOperatingDay, dayBlocks, manualScheduling: true };

  const slotCount = dayBlocks.reduce((sum, block) => sum + Math.max(0, block.slotsLeft || 0), 0);
  return { canBookDate: slotCount > 0, slotCount, isOperatingDay, dayBlocks, manualScheduling: false };
}

function BookingCalendarDialog({ onClose, worker, schedule, onConfirmBooking }: Omit<BookingCalendarModalProps, "isOpen"> & { worker: BookingWorker; schedule: BookingSchedule }) {
  const now = new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [missingStep, setMissingStep] = useState<"date" | "time" | null>(null);
  const calendarSectionRef = useRef<HTMLElement>(null);
  const timeSectionRef = useRef<HTMLElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthCells = getMonthCells(visibleMonth);
  const selectedDateMeta = getDateMeta(schedule, selectedDate);
  const selectedBlock = selectedDateMeta.dayBlocks.find((block) => block.id === selectedBlockId);
  const canConfirmManual = Boolean(schedule.manualScheduling && selectedDate);
  const canConfirmFixed = Boolean(!schedule.manualScheduling && selectedDate && selectedBlock && selectedBlock.slotsLeft > 0);
  const canReview = canConfirmManual || canConfirmFixed;

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDate("");
    setSelectedBlockId("");
    setMissingStep(null);
  };

  const selectDate = (dateValue: string) => {
    if (!getDateMeta(schedule, dateValue).canBookDate) return;
    setSelectedDate(dateValue);
    setSelectedBlockId("");
    setMissingStep(null);
  };

  const confirmBooking = () => {
    onConfirmBooking({
      workerId: worker.id,
      date: selectedDate,
      dayKey: getDayKeyFromDate(selectedDate),
      blockId: selectedBlockId,
      manualScheduling: schedule.manualScheduling,
    });
    setIsReviewOpen(false);
  };

  const confirmHint = !selectedDate
    ? "Next: choose an available date."
    : !schedule.manualScheduling && !selectedBlock
      ? "Required: select one of the available times above."
      : "Your date and time are ready to review.";

  const reviewBooking = () => {
    if (!selectedDate) {
      setMissingStep("date");
      calendarSectionRef.current?.focus();
      calendarSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      return;
    }
    if (!schedule.manualScheduling && !selectedBlock) {
      setMissingStep("time");
      timeSectionRef.current?.focus();
      timeSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    setMissingStep(null);
    setIsReviewOpen(true);
  };

  return (
    <>
      <Dialog open={!isReviewOpen} onOpenChange={(open) => { if (!open && !isReviewOpen) onClose?.(); }}>
        <DialogContent className="max-h-[calc(100svh-1rem)] max-w-4xl gap-0 overflow-y-auto p-0 sm:max-h-[calc(100svh-2rem)]">
          <DialogHeader className="bg-muted/45 px-5 py-5 pr-16 sm:px-6 sm:py-6 sm:pr-16">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" aria-hidden="true" /></span>
              <div>
                <DialogTitle className="text-2xl">Choose a booking schedule</DialogTitle>
                <DialogDescription className="mt-1.5">
                  Booking with <strong className="text-foreground">{worker.name || "this provider"}</strong>{worker.title ? ` for ${worker.title}` : ""}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6">
            <section ref={calendarSectionRef} tabIndex={-1} aria-labelledby="booking-month-heading" className="scroll-mt-4 focus:outline-none">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></Button>
                <h3 id="booking-month-heading" className="text-lg font-bold text-foreground">{formatMonthHeading(visibleMonth)}</h3>
                <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight aria-hidden="true" /></Button>
              </div>

              <div className="overflow-hidden rounded-xl bg-border shadow-sm">
                <div className="grid grid-cols-7 gap-px" aria-hidden="true">
                  {DAY_KEYS.map((day) => <div className="bg-muted px-1 py-2 text-center text-xs font-bold text-muted-foreground" key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-px" role="grid" aria-label={formatMonthHeading(visibleMonth)}>
                  {monthCells.map((cell) => {
                    const dateValue = formatDateValue(cell.date);
                    const meta = getDateMeta(schedule, dateValue);
                    const isPast = cell.date < today;
                    const disabled = !cell.isCurrentMonth || isPast || !meta.canBookDate;
                    const selected = selectedDate === dateValue;
                    const dateLabel = formatLongDate(dateValue);
                    const availability = meta.manualScheduling ? "open scheduling" : `${meta.slotCount} ${meta.slotCount === 1 ? "slot" : "slots"} available`;

                    return (
                      <button
                        key={dateValue}
                        type="button"
                        role="gridcell"
                        className={cn(
                          "relative flex min-h-16 flex-col items-start justify-between bg-background p-2 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-20",
                          !cell.isCurrentMonth && "bg-muted/60 text-muted-foreground",
                          !disabled && "hover:bg-primary/5",
                          selected && "bg-primary text-primary-foreground hover:bg-primary",
                          disabled && "cursor-not-allowed opacity-45",
                        )}
                        disabled={disabled}
                        onClick={() => selectDate(dateValue)}
                        aria-label={`${dateLabel}, ${availability}`}
                        aria-selected={selected}
                      >
                        <span className="text-sm font-bold sm:text-base">{cell.date.getDate()}</span>
                        <span className={cn("hidden text-[11px] font-medium sm:block", selected ? "text-primary-foreground/85" : "text-muted-foreground")}>
                          {meta.manualScheduling ? "Open" : meta.slotCount ? `${meta.slotCount} left` : "Full"}
                        </span>
                        {!disabled && !selected ? <span className="size-1.5 rounded-full bg-primary sm:hidden" aria-hidden="true" /> : null}
                        {selected ? <Check className="absolute right-1.5 top-1.5 size-4" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-primary/5 p-4" aria-labelledby="selected-date-heading">
              <div className="flex gap-3">
                <CalendarCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 id="selected-date-heading" className="font-semibold text-foreground">Selected date</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedDate ? formatLongDate(selectedDate) : "No date selected yet"}</p>
                </div>
              </div>
            </section>

            {schedule.manualScheduling ? (
              <section className="rounded-xl bg-brand-highlight-soft/70 p-4" aria-labelledby="manual-scheduling-heading">
                <div className="flex gap-3">
                  <MessageSquareText className="mt-0.5 size-5 shrink-0 text-brand-highlight-foreground" aria-hidden="true" />
                  <div><h3 id="manual-scheduling-heading" className="font-semibold text-foreground">Time confirmed through chat</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">Choose a date and the provider will coordinate the exact time with you.</p></div>
                </div>
              </section>
            ) : (
              <section ref={timeSectionRef} tabIndex={-1} aria-labelledby="available-times-heading" className="scroll-mt-4 rounded-xl bg-muted/35 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">2</span>
                  <Clock className="size-5 text-primary" aria-hidden="true" />
                  <h3 id="available-times-heading" className="font-semibold text-foreground">Select an available time</h3>
                  <span className="rounded-full bg-brand-highlight-soft px-2 py-1 text-xs font-bold text-brand-highlight-foreground">Required</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {!selectedDate ? "First choose an available date above to see its time slots." : "Choose one time below. Your selection will turn blue."}
                </p>
                {missingStep === "time" ? (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand-highlight-soft px-3 py-2 text-sm font-semibold text-brand-highlight-foreground" role="alert">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    Select a time before reviewing your booking.
                  </p>
                ) : null}
                {selectedDate && selectedDateMeta.dayBlocks.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No configured time slots are available for this date.</p> : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {selectedDateMeta.dayBlocks.map((block) => {
                    const full = block.slotsLeft <= 0;
                    const selected = selectedBlockId === block.id;
                    return (
                      <button
                        key={block.id}
                        type="button"
                        className={cn(
                          "flex min-h-16 items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          !full && "hover:bg-primary/5",
                          selected && "bg-primary text-primary-foreground hover:bg-primary",
                          full && "cursor-not-allowed opacity-50",
                        )}
                        disabled={full}
                        onClick={() => { setSelectedBlockId(block.id); setMissingStep(null); }}
                        aria-pressed={selected}
                      >
                        <span><span className="block font-semibold">{formatTime(block.startTime)}–{formatTime(block.endTime)}</span><span className={cn("mt-1 block text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{full ? "No spots left" : `${block.slotsLeft} ${block.slotsLeft === 1 ? "spot" : "spots"} left`}</span></span>
                        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                          {selected ? <><span>Selected</span><CheckCircle2 className="size-5" aria-hidden="true" /></> : <><span>Select</span><span className="size-5 rounded-full border-2 border-muted-foreground/50" aria-hidden="true" /></>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="sticky bottom-0 bg-background px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
            <div className={cn("mr-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", canReview ? "bg-primary/5 text-foreground" : "bg-brand-highlight-soft text-brand-highlight-foreground")}>
              {canReview ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="size-4 shrink-0" aria-hidden="true" />}
              <p>{confirmHint}</p>
            </div>
            <Button className="w-full sm:w-auto" onClick={reviewBooking}>Review booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewOpen} onOpenChange={(open) => { if (!open) setIsReviewOpen(false); }}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 [&>button]:!text-primary-foreground [&>button]:hover:!bg-white/15">
          <DialogHeader className="bg-primary px-6 py-6 pr-16 text-primary-foreground">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <CalendarCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary-foreground/75">Final step</p>
                <DialogTitle className="text-2xl text-primary-foreground">Confirm booking request</DialogTitle>
                <DialogDescription className="mt-1.5 text-primary-foreground/80">
                  Check the schedule below before sending it to the provider.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">You’re requesting</p>
              <p className="mt-1 text-lg font-bold text-foreground">{worker.title || "Service appointment"}</p>
            </div>

            <dl className="divide-y rounded-xl bg-muted/50 px-4">
              <div className="flex items-start gap-3 py-4">
                <UserRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provider</dt><dd className="mt-1 font-semibold text-foreground">{worker.name || "Service provider"}</dd></div>
              </div>
              <div className="flex items-start gap-3 py-4">
                <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</dt><dd className="mt-1 text-lg font-bold text-foreground">{selectedDate ? formatLongDate(selectedDate) : "Not selected"}</dd></div>
              </div>
              <div className="flex items-start gap-3 py-4">
                <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</dt><dd className="mt-1 text-lg font-bold text-foreground">{schedule.manualScheduling ? "Confirmed through chat" : selectedBlock ? `${formatTime(selectedBlock.startTime)}–${formatTime(selectedBlock.endTime)}` : "Not selected"}</dd></div>
              </div>
            </dl>

            <div className="flex gap-3 rounded-xl bg-primary/5 p-4 text-sm leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p>Sending this request does not charge you. The provider will receive the booking details and confirm the next step.</p>
            </div>
          </div>

          <DialogFooter className="bg-muted/40 px-6 py-4">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setIsReviewOpen(false)}>Back to schedule</Button>
            <Button className="w-full sm:w-auto" onClick={confirmBooking}><Send aria-hidden="true" />Send booking request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function BookingCalendarModal(props: BookingCalendarModalProps) {
  if (!props.isOpen || !props.worker || !props.schedule) return null;
  return <BookingCalendarDialog {...props} worker={props.worker} schedule={props.schedule} />;
}
