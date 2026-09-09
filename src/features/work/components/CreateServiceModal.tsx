import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronDown, ChevronRight, Copy, FileText, Plus, Trash2 } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DAY_ORDER, WEEKDAY_ORDER } from "@/features/work/services/scheduleService";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type BookingMode = "with-slots" | "calendar-only";
type PricingModel = "fixed" | "hourly" | "daily" | "weekly" | "monthly" | "package" | "quote";

interface AvailabilitySlot {
  capacity: number | string;
  endTime: string;
  id: string;
  startTime: string;
}

type Availability = Record<DayKey, AvailabilitySlot[]>;

interface NewServiceDraft {
  availability?: Partial<Availability>;
  basePrice: string | number;
  bookingMode: string;
  description: string;
  durationMinutes: string | number;
  priceType: string;
  rateBasis: string;
  shortDescription: string;
  title: string;
}

interface CreateServiceModalProps {
  appTheme?: string;
  isOpen: boolean;
  newService: NewServiceDraft;
  onChange: (field: string, value: unknown) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<unknown>;
}

const DAYS = DAY_ORDER as DayKey[];
const WEEKDAYS = WEEKDAY_ORDER as DayKey[];
const DAY_LABELS: Record<DayKey, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const BOOKING_METHODS: Array<{ value: BookingMode; label: string; description: string }> = [
  { value: "with-slots", label: "Time-slot booking", description: "Clients choose from times you publish." },
  { value: "calendar-only", label: "Request booking", description: "Clients send a request and coordinate with you." },
];

const PRICING_MODELS: Array<{ value: PricingModel; label: string; priceType: string; rateBasis: string }> = [
  { value: "fixed", label: "Fixed price", priceType: "fixed", rateBasis: "per-project" },
  { value: "hourly", label: "Hourly", priceType: "hourly", rateBasis: "per-hour" },
  { value: "daily", label: "Daily", priceType: "fixed", rateBasis: "per-day" },
  { value: "weekly", label: "Weekly", priceType: "fixed", rateBasis: "per-week" },
  { value: "monthly", label: "Monthly", priceType: "fixed", rateBasis: "per-month" },
  { value: "package", label: "Package", priceType: "package", rateBasis: "per-project" },
  { value: "quote", label: "Request a quote", priceType: "inquiry", rateBasis: "per-project" },
];

const PRICE_FIELD_LABELS: Record<PricingModel, string> = {
  fixed: "Service price (PHP)",
  hourly: "Hourly rate (PHP)",
  daily: "Daily rate (PHP)",
  weekly: "Weekly rate (PHP)",
  monthly: "Monthly rate (PHP)",
  package: "Package price (PHP)",
  quote: "",
};

const resolvePricingModel = (priceType: string, rateBasis: string): PricingModel => {
  if (priceType === "inquiry" || priceType === "custom") return "quote";
  if (priceType === "package") return "package";
  if (priceType === "hourly" || rateBasis === "per-hour") return "hourly";
  if (rateBasis === "per-day") return "daily";
  if (rateBasis === "per-week") return "weekly";
  if (rateBasis === "per-month") return "monthly";
  return "fixed";
};

const STEPS = ["Details", "Booking", "Review"] as const;

const createClientSlotId = (dayKey: string) =>
  `${dayKey.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getAvailabilitySnapshot = (availability: Partial<Availability> = {}): Availability =>
  DAYS.reduce((schedule, dayKey) => {
    schedule[dayKey] = Array.isArray(availability[dayKey])
      ? availability[dayKey].map((slot) => ({ ...slot }))
      : [];
    return schedule;
  }, {} as Availability);

const cloneSlotForDay = (dayKey: DayKey, slot: AvailabilitySlot, index = 0): AvailabilitySlot => ({
  id: createClientSlotId(`${dayKey}-${index}`),
  startTime: slot.startTime || "09:00",
  endTime: slot.endTime || "17:00",
  capacity: slot.capacity || 1,
});

const isValidSlot = (slot: AvailabilitySlot) => Boolean(
  slot.startTime
  && slot.endTime
  && slot.endTime.slice(0, 5) > slot.startTime.slice(0, 5)
  && Number(slot.capacity) > 0
);

function CreateServiceModal({ isOpen, newService, onChange, onClose, onSubmit }: CreateServiceModalProps) {
  const [step, setStep] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Partial<Record<DayKey, boolean>>>({ Mon: true });
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availability = useMemo(
    () => getAvailabilitySnapshot(newService.availability),
    [newService.availability],
  );
  const pricingModel = resolvePricingModel(newService.priceType, newService.rateBasis);
  const isQuotePricing = pricingModel === "quote";
  const bookingMode: BookingMode = isQuotePricing || newService.bookingMode === "calendar-only" ? "calendar-only" : "with-slots";
  const showAvailability = bookingMode === "with-slots";
  const slotCount = DAYS.reduce(
    (total, dayKey) => total + availability[dayKey].filter(isValidSlot).length,
    0,
  );
  const invalidSlotCount = DAYS.reduce(
    (total, dayKey) => total + availability[dayKey].filter((slot) => !isValidSlot(slot)).length,
    0,
  );

  const updateAvailability = (updater: (next: Availability) => void) => {
    const next = getAvailabilitySnapshot(availability);
    updater(next);
    onChange("availability", next);
  };

  const handleAddSlot = (dayKey: DayKey) => {
    updateAvailability((next) => {
      const lastSlot = next[dayKey].at(-1);
      next[dayKey] = [...next[dayKey], {
        id: createClientSlotId(dayKey),
        startTime: lastSlot?.endTime || "09:00",
        endTime: lastSlot ? "17:00" : "11:00",
        capacity: lastSlot?.capacity || 1,
      }];
    });
    setExpandedDays((previous) => ({ ...previous, [dayKey]: true }));
    setLocalError("");
  };

  const handleSlotChange = (dayKey: DayKey, slotId: string, field: keyof AvailabilitySlot, value: string) => {
    updateAvailability((next) => {
      next[dayKey] = next[dayKey].map((slot) => slot.id === slotId ? { ...slot, [field]: value } : slot);
    });
    setLocalError("");
  };

  const handleRemoveSlot = (dayKey: DayKey, slotId: string) => {
    updateAvailability((next) => {
      next[dayKey] = next[dayKey].filter((slot) => slot.id !== slotId);
    });
  };

  const copyMondayToDays = (targetDays: DayKey[]) => {
    if (availability.Mon.length === 0) return;
    updateAvailability((next) => {
      targetDays.forEach((dayKey) => {
        next[dayKey] = availability.Mon.map((slot, index) => cloneSlotForDay(dayKey, slot, index));
      });
    });
    setLocalError("");
  };

  const handlePricingModelChange = (value: string) => {
    const model = PRICING_MODELS.find((option) => option.value === value);
    if (!model) return;
    onChange("priceType", model.priceType);
    onChange("rateBasis", model.rateBasis);
    if (model.value === "quote") {
      onChange("basePrice", "");
      onChange("bookingMode", "calendar-only");
    }
    setLocalError("");
  };

  const validateStep = (targetStep = step) => {
    if (targetStep === 0 && !newService.title.trim()) {
      setLocalError("Enter a service title before continuing.");
      return false;
    }
    if (targetStep === 0 && !newService.shortDescription.trim()) {
      setLocalError("Add a short description so clients can understand the service.");
      return false;
    }
    if (targetStep === 0 && !isQuotePricing && (!newService.basePrice || Number(newService.basePrice) < 0)) {
      setLocalError("Enter a valid service price before continuing.");
      return false;
    }
    if (targetStep === 1 && showAvailability && slotCount === 0) {
      setLocalError("Add at least one valid availability slot before continuing.");
      return false;
    }
    if (targetStep === 1 && showAvailability && invalidSlotCount > 0) {
      setLocalError("Check the highlighted schedule entries. End time must follow start time and capacity must be at least one.");
      return false;
    }
    setLocalError("");
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(1)) return;
    try {
      setIsSubmitting(true);
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent
        data-testid="create-service-modal"
        className="grid w-[calc(100vw-2rem)] max-w-[840px] max-h-[calc(100svh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:w-[calc(100vw-1rem)] max-sm:max-h-[calc(100svh-1rem)] max-sm:rounded-xl"
      >
        <DialogHeader className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle>Add a service</DialogTitle>
          <DialogDescription>Create a clear listing clients can understand and book confidently.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 border-y border-border" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((label, index) => (
            <div key={label} className={cn("flex min-h-14 items-center justify-center gap-2 px-2 text-xs font-semibold sm:text-sm", index === step ? "bg-primary/5 text-primary" : "text-muted-foreground")}>
              <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", index < step ? "bg-emerald-600 text-white" : index === step ? "bg-primary text-primary-foreground" : "bg-muted")}>{index < step ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
          {localError ? <div className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{localError}</div> : null}

          {step === 0 ? (
            <div className="space-y-6">
              <section aria-labelledby="service-details-title">
                <div className="mb-4 flex items-start gap-3"><FileText className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><h3 id="service-details-title" className="font-semibold">Service details</h3><p className="text-sm text-muted-foreground">Use plain language and describe exactly what clients receive.</p></div></div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="service-title">Service title <span className="text-destructive">*</span></Label><Input id="service-title" placeholder="e.g. Appliance installation and repair" value={newService.title} onChange={(event) => onChange("title", event.target.value)} /></div>
                  <div className="space-y-2"><div className="flex justify-between gap-4"><Label htmlFor="service-summary">Short description <span className="text-destructive">*</span></Label><span className="text-xs text-muted-foreground">{newService.shortDescription.length}/160</span></div><Input id="service-summary" maxLength={160} placeholder="A one-sentence summary shown in search results" value={newService.shortDescription} onChange={(event) => onChange("shortDescription", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="service-description">Detailed description</Label><textarea id="service-description" className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Describe the work included, important limitations, and what clients should prepare." value={newService.description} onChange={(event) => onChange("description", event.target.value)} /></div>
                </div>
              </section>

              <Separator />

              <section aria-labelledby="service-pricing-title">
                <div className="mb-4"><h3 id="service-pricing-title" className="font-semibold">Pricing</h3><p className="text-sm text-muted-foreground">Set a transparent starting price and how it is calculated.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2"><Label htmlFor="pricing-model">Pricing model</Label><Select value={pricingModel} onValueChange={handlePricingModelChange}><SelectTrigger id="pricing-model"><SelectValue /></SelectTrigger><SelectContent>{PRICING_MODELS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                  {!isQuotePricing ? <div className="space-y-2"><Label htmlFor="service-price">{PRICE_FIELD_LABELS[pricingModel]} <span className="text-destructive">*</span></Label><Input id="service-price" type="number" min="0" inputMode="decimal" placeholder="0.00" value={newService.basePrice} onChange={(event) => onChange("basePrice", event.target.value)} /></div> : <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Clients will contact you for a personalized price. No public amount is required.</div>}
                  <div className="space-y-2"><Label htmlFor="service-duration">Estimated duration</Label><div className="relative"><Input id="service-duration" className="pr-16" type="number" min="1" step="15" inputMode="numeric" placeholder="Optional" value={newService.durationMinutes} onChange={(event) => onChange("durationMinutes", event.target.value)} /><span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span></div></div>
                </div>
              </section>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <section aria-labelledby="booking-method-title">
                <div className="mb-4"><h3 id="booking-method-title" className="font-semibold">How should clients book?</h3><p className="text-sm text-muted-foreground">Choose the workflow that best matches this service.</p></div>
                <div role="radiogroup" aria-label="Booking method" className="grid gap-3 sm:grid-cols-2">
                  {BOOKING_METHODS.map((method) => {
                    const isSelected = bookingMode === method.value;
                    const isDisabled = isQuotePricing && method.value === "with-slots";
                    return <button key={method.value} type="button" role="radio" aria-checked={isSelected} disabled={isDisabled} className={cn("min-h-24 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45", isSelected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/50")} onClick={() => { onChange("bookingMode", method.value); setLocalError(""); }}><span className="flex items-center justify-between gap-3 font-semibold"><span>{method.label}</span>{isSelected ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}</span><span className="mt-2 block text-sm font-normal leading-5 text-muted-foreground">{isDisabled ? "Unavailable because custom quotes require a client request." : method.description}</span></button>;
                  })}
                </div>
              </section>

              {showAvailability ? <><Separator /><section aria-labelledby="availability-title">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><h3 id="availability-title" className="font-semibold">Weekly availability</h3><p className="text-sm text-muted-foreground">{slotCount} valid {slotCount === 1 ? "slot" : "slots"} configured</p></div></div>
                  <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={availability.Mon.length === 0} onClick={() => copyMondayToDays(WEEKDAYS.filter((day) => day !== "Mon"))}><Copy aria-hidden="true" />Weekdays</Button><Button type="button" size="sm" variant="outline" disabled={availability.Mon.length === 0} onClick={() => copyMondayToDays(DAYS.filter((day) => day !== "Mon"))}><Copy aria-hidden="true" />Whole week</Button></div>
                </div>

                <div className="divide-y divide-border rounded-xl bg-muted/35 px-3">
                  {DAYS.map((dayKey) => {
                    const slots = availability[dayKey];
                    const expanded = Boolean(expandedDays[dayKey]);
                    return <div key={dayKey}>
                      <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setExpandedDays((previous) => ({ ...previous, [dayKey]: !previous[dayKey] }))} aria-expanded={expanded}><span className="inline-flex items-center gap-2 font-semibold">{expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}{DAY_LABELS[dayKey]}</span><span className="text-xs font-medium text-muted-foreground">{slots.length} {slots.length === 1 ? "slot" : "slots"}</span></button>
                      {expanded ? <div className="space-y-3 pb-4 pl-6">
                        {slots.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No times added for {DAY_LABELS[dayKey]}.</p> : null}
                        {slots.map((slot) => <div key={slot.id} className={cn("grid gap-3 rounded-lg bg-background p-3 sm:grid-cols-[1fr_1fr_0.7fr_auto] sm:items-end", !isValidSlot(slot) && "bg-destructive/5")}>
                          <div className="space-y-2"><Label htmlFor={`${slot.id}-start`}>Start</Label><Input id={`${slot.id}-start`} type="time" value={slot.startTime} onChange={(event) => handleSlotChange(dayKey, slot.id, "startTime", event.target.value)} /></div>
                          <div className="space-y-2"><Label htmlFor={`${slot.id}-end`}>End</Label><Input id={`${slot.id}-end`} type="time" value={slot.endTime} onChange={(event) => handleSlotChange(dayKey, slot.id, "endTime", event.target.value)} /></div>
                          <div className="space-y-2"><Label htmlFor={`${slot.id}-capacity`}>Capacity</Label><Input id={`${slot.id}-capacity`} type="number" min="1" value={slot.capacity} onChange={(event) => handleSlotChange(dayKey, slot.id, "capacity", event.target.value)} /></div>
                          <Button type="button" size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveSlot(dayKey, slot.id)} aria-label={`Remove ${DAY_LABELS[dayKey]} slot`}><Trash2 aria-hidden="true" /></Button>
                        </div>)}
                        <Button type="button" size="sm" variant="ghost" className="text-primary" onClick={() => handleAddSlot(dayKey)}><Plus aria-hidden="true" />Add time</Button>
                      </div> : null}
                    </div>;
                  })}
                </div>
              </section></> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <section aria-labelledby="service-review-title">
              <div className="mb-5"><h3 id="service-review-title" className="font-semibold">Review service</h3><p className="text-sm text-muted-foreground">Confirm these details before publishing the listing.</p></div>
              <dl className="divide-y divide-border rounded-xl bg-muted/35 px-4">
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-muted-foreground">Service</dt><dd className="font-semibold">{newService.title}</dd></div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-muted-foreground">Summary</dt><dd className="text-sm">{newService.shortDescription}</dd></div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-muted-foreground">Pricing</dt><dd className="font-semibold">{isQuotePricing ? "Request a quote" : `PHP ${Number(newService.basePrice || 0).toLocaleString("en-PH")} · ${PRICING_MODELS.find((option) => option.value === pricingModel)?.label}`}</dd></div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-muted-foreground">Booking</dt><dd className="font-semibold">{BOOKING_METHODS.find((method) => method.value === bookingMode)?.label}</dd></div>
                {showAvailability ? <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-muted-foreground">Availability</dt><dd className="font-semibold">{slotCount} weekly {slotCount === 1 ? "slot" : "slots"}</dd></div> : null}
              </dl>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Publishing makes this service available in Browse Services. You can update its details later from My Work.</p>
            </section>
          ) : null}
        </div>

        <DialogFooter className="px-5 pb-5 pt-4 sm:px-6">
          {step === 0 ? <Button type="button" variant="outline" onClick={onClose}>Cancel</Button> : <Button type="button" variant="outline" onClick={() => { setLocalError(""); setStep((current) => current - 1); }}>Back</Button>}
          {step < STEPS.length - 1 ? <Button type="button" onClick={handleNext}>Continue</Button> : <Button type="button" onClick={() => void handleSubmit()} isLoading={isSubmitting}>{isSubmitting ? "Publishing…" : "Publish service"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateServiceModal;
