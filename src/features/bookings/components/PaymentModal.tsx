import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  LockKeyhole,
  Send,
  Smartphone,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { calculateBookingPricing } from "@/features/bookings/utils/bookingPricing";

type PaymentPlan = "full" | "downpayment";
type PaymentMethod = "gcash-advance" | "after-service";
type ResolvedPaymentMethod = "gcash-advance" | "after-service-cash" | "after-service-gcash";

interface PaymentTimeBlock {
  startTime?: string;
}

interface PaymentBooking {
  id?: string;
  afterServicePaymentType?: "both" | "cash-only" | "gcash-only";
  allowGcashAdvance?: boolean;
  balanceDueAmount?: number | string;
  bookingMode?: string;
  isRequestBooking?: boolean;
  paymentPlan?: string;
  paymentStatus?: string;
  quoteAmount?: number | string;
  selectedSlot?: { date?: string; timeBlock?: PaymentTimeBlock };
  serviceType?: string;
  workerName?: string;
}

export interface MockPaymentDetails {
  mockPaymentReference: string;
  mockPaymentAt: string;
  mockPaymentProvider: string;
  mockPaymentStatus: "test-approved";
  serviceAmount: number;
  transactionFeeRate: number;
  transactionFeePercent: string;
  transactionFeeAmount: number;
  totalChargedAmount: number;
  paymentPlan: PaymentPlan;
  serviceDownpaymentAmount: number;
  upfrontPaymentAmount: number;
  remainingBalanceAmount: number;
  paymentAttemptAmount: number;
}

export interface PaymentModalProps {
  advancePaymentDescription?: string;
  amountLabel?: string;
  booking: PaymentBooking;
  confirmLabel?: string;
  onCancel: () => void;
  onSelectPayment: (method: ResolvedPaymentMethod, details: MockPaymentDetails) => unknown;
  scheduleLabel?: string;
  scheduleValue?: string;
  subtitle?: string;
  title?: string;
  transactionFeeRate?: number | string | null;
}

function formatPhp(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTime(time?: string) {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return time || "TBD";
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatSchedule(booking: PaymentBooking) {
  if (booking.bookingMode === "calendar-only" || booking.isRequestBooking) return "Coordinated through chat";
  const date = booking.selectedSlot?.date;
  const time = booking.selectedSlot?.timeBlock?.startTime;
  if (!date) return "Schedule pending";
  const parsedDate = new Date(`${date}T00:00:00`);
  const dateLabel = Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(parsedDate);
  return `${dateLabel} · ${formatTime(time)}`;
}

function buildMockReference(method: ResolvedPaymentMethod) {
  const date = new Date();
  const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
  return `MOCK-${method.toUpperCase()}-${stamp}-${Math.floor(Math.random() * 900000 + 100000)}`;
}

export default function PaymentModal({
  advancePaymentDescription,
  amountLabel = "Service price",
  booking,
  confirmLabel = "Continue with GCash",
  onCancel,
  onSelectPayment,
  scheduleLabel,
  scheduleValue,
  subtitle,
  title = "Choose payment",
  transactionFeeRate,
}: PaymentModalProps) {
  const allowsAdvanceGcash = booking.allowGcashAdvance !== false;
  const allowsAfterService = false;
  const afterServicePaymentType = booking.afterServicePaymentType || "both";
  const isRequestBooking = booking.bookingMode === "calendar-only" || booking.isRequestBooking;
  const baseAmount = Number(booking.quoteAmount || 0) || 0;
  const pricing = calculateBookingPricing(baseAmount, transactionFeeRate);
  const isPayingRemainingBalance = booking.paymentStatus === "partially_paid";
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(allowsAdvanceGcash ? "gcash-advance" : null);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>(booking.paymentPlan === "downpayment" ? "downpayment" : "full");
  const [afterServiceChannel, setAfterServiceChannel] = useState<"cash" | "gcash">(afterServicePaymentType === "gcash-only" ? "gcash" : "cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedReference, setCompletedReference] = useState("");
  const [submitError, setSubmitError] = useState("");

  const amountDueNow = isPayingRemainingBalance
    ? Number(booking.balanceDueAmount || pricing.downpaymentBalanceAmount)
    : paymentPlan === "downpayment"
      ? pricing.downpaymentUpfrontAmount
      : pricing.totalChargedAmount;
  const remainingBalance = !isPayingRemainingBalance && paymentPlan === "downpayment" ? pricing.downpaymentBalanceAmount : 0;
  const resolvedSubtitle = subtitle || `Review the amount and payment option for ${booking.workerName || "this provider"}.`;
  const resolvedScheduleLabel = scheduleLabel?.replace(/:$/, "") || (isRequestBooking ? "Schedule" : "Appointment");
  const resolvedScheduleValue = scheduleValue || formatSchedule(booking);

  const handleConfirmPayment = async () => {
    if (!selectedMethod) {
      setSubmitError("Select a payment method before continuing.");
      return;
    }
    const resolvedMethod: ResolvedPaymentMethod = selectedMethod === "after-service"
      ? afterServiceChannel === "gcash" ? "after-service-gcash" : "after-service-cash"
      : "gcash-advance";

    try {
      setSubmitError("");
      setIsProcessing(true);
      const paymentDetails: MockPaymentDetails = {
        mockPaymentReference: buildMockReference(resolvedMethod),
        mockPaymentAt: new Date().toISOString(),
        mockPaymentProvider: resolvedMethod.includes("gcash") ? "GCash sandbox" : "Cash confirmation sandbox",
        mockPaymentStatus: "test-approved",
        serviceAmount: baseAmount,
        transactionFeeRate: pricing.transactionFeeRate,
        transactionFeePercent: pricing.transactionFeePercent,
        transactionFeeAmount: pricing.transactionFeeAmount,
        totalChargedAmount: pricing.totalChargedAmount,
        paymentPlan,
        serviceDownpaymentAmount: pricing.serviceDownpaymentAmount,
        upfrontPaymentAmount: amountDueNow,
        remainingBalanceAmount: remainingBalance,
        paymentAttemptAmount: amountDueNow,
      };
      await Promise.resolve(onSelectPayment(resolvedMethod, paymentDetails));
      setCompletedReference(paymentDetails.mockPaymentReference);
    } catch {
      setSubmitError("We couldn’t save this payment choice. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isProcessing) onCancel(); }}>
      <DialogContent className="max-h-[calc(100svh-1rem)] max-w-3xl gap-0 overflow-y-auto p-0 sm:max-h-[calc(100svh-2rem)]">
        <DialogHeader className="bg-muted/45 px-5 py-5 pr-16 sm:px-6 sm:py-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <WalletCards className="size-5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle className="text-2xl">{isProcessing ? "Creating your booking" : completedReference ? "Booking request created" : title}</DialogTitle>
              <DialogDescription className="mt-1.5 leading-5">{isProcessing ? "Saving your booking and payment choice securely." : completedReference ? "Your request was saved successfully." : resolvedSubtitle}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isProcessing ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center" role="status" aria-live="polite">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-foreground">Creating your booking</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Keep this window open while we save the schedule and payment information.</p>
          </div>
        ) : completedReference ? (
          <>
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="size-9" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-2xl font-bold text-foreground">Your booking request is ready</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">The provider can now review your request. You’ll receive an update when the booking moves forward.</p>
              <div className="mt-6 grid w-full max-w-md gap-3 rounded-xl bg-muted/45 p-4 text-left sm:grid-cols-2">
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Service</p><p className="mt-1 font-semibold text-foreground">{booking.serviceType || "Service booking"}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Amount submitted</p><p className="mt-1 text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatPhp(amountDueNow)}</p></div>
                <div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Test payment reference</p><p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">{completedReference}</p></div>
              </div>
            </div>
            <DialogFooter className="bg-muted/40 px-4 py-4 sm:px-6">
              <Button type="button" className="w-full sm:w-auto" onClick={onCancel}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
          <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6">
          <section className="grid gap-4 rounded-xl bg-muted/45 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" aria-labelledby="payment-summary-heading">
            <div className="min-w-0">
              <p id="payment-summary-heading" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Booking summary</p>
              <h3 className="mt-1 text-lg font-bold text-foreground">{booking.serviceType || "Service booking"}</h3>
              <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span><strong className="font-semibold text-foreground">{resolvedScheduleLabel}:</strong> {resolvedScheduleValue}</span>
              </p>
            </div>
            <div className="rounded-lg bg-background px-4 py-3 sm:min-w-48 sm:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Amount due now</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatPhp(amountDueNow)}</p>
              {remainingBalance > 0 ? <p className="mt-1 text-xs text-muted-foreground">{formatPhp(remainingBalance)} due after service</p> : null}
            </div>
          </section>

          {!isPayingRemainingBalance ? (
            <section aria-labelledby="payment-plan-heading">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">1</span>
                <h3 id="payment-plan-heading" className="font-semibold text-foreground">Choose how much to pay now</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment amount">
                {([
                  { value: "full" as const, label: "Full payment", due: pricing.totalChargedAmount, description: "Pay the service price and platform fee now." },
                  { value: "downpayment" as const, label: "50% downpayment", due: pricing.downpaymentUpfrontAmount, description: `${formatPhp(pricing.downpaymentBalanceAmount)} remains after service.` },
                ]).map((option) => {
                  const selected = paymentPlan === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPaymentPlan(option.value)}
                      className={cn(
                        "min-h-28 rounded-xl bg-muted/45 p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      <span className="flex items-center justify-between gap-3 font-bold">
                        {option.label}
                        {selected ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <span className="size-5 rounded-full border-2 border-muted-foreground/40" aria-hidden="true" />}
                      </span>
                      <span className="mt-2 block text-xl font-extrabold">{formatPhp(option.due)}</span>
                      <span className={cn("mt-1 block text-xs leading-5", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="payment-method-heading">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">{isPayingRemainingBalance ? "1" : "2"}</span>
              <h3 id="payment-method-heading" className="font-semibold text-foreground">Payment method</h3>
            </div>

            {allowsAdvanceGcash ? (
              <button
                type="button"
                role="radio"
                aria-checked={selectedMethod === "gcash-advance"}
                onClick={() => { setSelectedMethod("gcash-advance"); setSubmitError(""); }}
                className={cn(
                  "flex min-h-20 w-full items-start gap-3 rounded-xl bg-muted/45 p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedMethod === "gcash-advance" && "bg-primary/10",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Smartphone className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-bold text-foreground">GCash advance payment <Badge variant="default">Selected</Badge></span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">{advancePaymentDescription || (isRequestBooking ? "Pay through GCash after agreeing on the details in chat." : "Pay securely through the GCash step to reserve this booking.")}</span>
                </span>
              </button>
            ) : (
              <p className="rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">No payment method is available for this booking.</p>
            )}

            {allowsAfterService ? (
              <div className="mt-3 rounded-xl bg-muted/45 p-4">
                <button type="button" role="radio" aria-checked={selectedMethod === "after-service"} onClick={() => setSelectedMethod("after-service")}>Pay after service</button>
                {selectedMethod === "after-service" && afterServicePaymentType === "both" ? (
                  <div className="mt-3 flex gap-2">
                    {(["cash", "gcash"] as const).map((channel) => <Button key={channel} type="button" variant={afterServiceChannel === channel ? "primary" : "outline"} onClick={() => setAfterServiceChannel(channel)}>{channel === "cash" ? "Cash" : "GCash"}</Button>)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="mt-2 overflow-hidden rounded-xl bg-muted/40" aria-labelledby="payment-breakdown-heading">
            <div className="flex items-center gap-3 bg-secondary/70 px-4 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                <CircleDollarSign className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 id="payment-breakdown-heading" className="font-bold text-foreground">Payment breakdown</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Review how your total is calculated.</p>
              </div>
            </div>
            <dl className="divide-y px-4 py-2 text-sm">
              <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{amountLabel}</dt><dd className="font-semibold text-foreground">{formatPhp(baseAmount)}</dd></div>
              {pricing.transactionFeeRate > 0 ? <div className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">Platform fee ({pricing.transactionFeePercent})</dt><dd className="font-semibold text-foreground">{formatPhp(pricing.transactionFeeAmount)}</dd></div> : null}
              <div className="flex justify-between gap-4 py-3"><dt className="font-bold text-foreground">Total payment</dt><dd className="text-base font-extrabold text-foreground">{formatPhp(pricing.totalChargedAmount)}</dd></div>
            </dl>
          </section>

          {submitError ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">{submitError}</p> : null}
        </div>

        <DialogFooter className="sticky bottom-0 items-center bg-background px-4 py-4 sm:px-6">
          <div className="mr-auto min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><LockKeyhole className="size-3.5" aria-hidden="true" />Due now</p>
            <p className="mt-0.5 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatPhp(amountDueNow)}</p>
          </div>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>Cancel</Button>
          <Button type="button" onClick={() => { void handleConfirmPayment(); }} disabled={!selectedMethod} isLoading={isProcessing}>
            {isProcessing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {isProcessing ? "Saving payment…" : confirmLabel}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
