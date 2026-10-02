import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  Send,
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
type PaymentMethod = "paymongo-card";

interface PaymentTimeBlock {
  startTime?: string;
}

interface PaymentBooking {
  id?: string;
  activeQuote?: { proposed_start_ts?: string; proposed_end_ts?: string } | null;
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

export interface PaymentSelectionDetails {
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
  onSelectPayment: (method: PaymentMethod, details: PaymentSelectionDetails) => unknown;
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
  if (booking.activeQuote?.proposed_start_ts) {
    const start = new Date(booking.activeQuote.proposed_start_ts);
    const end = booking.activeQuote.proposed_end_ts ? new Date(booking.activeQuote.proposed_end_ts) : null;
    const date = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(start);
    const startTime = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(start);
    const endTime = end ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(end) : null;
    return `${date} · ${startTime}${endTime ? `–${endTime}` : ""}`;
  }
  if (booking.bookingMode === "calendar-only" || booking.isRequestBooking) return "Waiting for a provider schedule";
  const date = booking.selectedSlot?.date;
  const time = booking.selectedSlot?.timeBlock?.startTime;
  if (!date) return "Schedule pending";
  const parsedDate = new Date(`${date}T00:00:00`);
  const dateLabel = Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(parsedDate);
  return `${dateLabel} · ${formatTime(time)}`;
}

export default function PaymentModal({
  advancePaymentDescription,
  amountLabel = "Service price",
  booking,
  confirmLabel = "Reserve and continue",
  onCancel,
  onSelectPayment,
  scheduleLabel,
  scheduleValue,
  subtitle,
  title = "Choose payment",
  transactionFeeRate,
}: PaymentModalProps) {
  const allowsPayMongo = true;
  const isRequestBooking = booking.bookingMode === "calendar-only" || booking.isRequestBooking;
  const baseAmount = Number(booking.quoteAmount || 0) || 0;
  const pricing = calculateBookingPricing(baseAmount, transactionFeeRate);
  const isPayingRemainingBalance = booking.paymentStatus === "partially_paid";
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(allowsPayMongo ? "paymongo-card" : null);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>(isRequestBooking && booking.paymentPlan !== "downpayment" ? "full" : "downpayment");
  const [isProcessing, setIsProcessing] = useState(false);
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
    try {
      setSubmitError("");
      setIsProcessing(true);
      const paymentDetails: PaymentSelectionDetails = {
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
      await Promise.resolve(onSelectPayment(selectedMethod, paymentDetails));
    } catch (error) {
      setSubmitError(error instanceof Error && error.message
        ? error.message
        : "We couldn't open secure PayMongo checkout. Please try again.");
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
              <DialogTitle className="text-2xl">{isProcessing ? "Reserving your time" : title}</DialogTitle>
              <DialogDescription className="mt-1.5 leading-5">{isProcessing ? "Protecting the selected time before opening PayMongo." : resolvedSubtitle}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isProcessing ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center" role="status" aria-live="polite">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LoaderCircle className="size-8 animate-spin" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-foreground">Reserving your time</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Keep this window open while we reserve the schedule and prepare secure card checkout.</p>
          </div>
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
              {remainingBalance > 0 ? <p className="mt-1 text-xs text-muted-foreground">{formatPhp(remainingBalance)} due before work starts</p> : null}
            </div>
          </section>

          {!isPayingRemainingBalance ? (
            <section aria-labelledby="payment-plan-heading">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">1</span>
                <h3 id="payment-plan-heading" className="font-semibold text-foreground">{isRequestBooking ? "Choose how much to pay now" : "50% deposit secures your schedule"}</h3>
              </div>
              {isRequestBooking ? <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment amount">{(["full", "downpayment"] as const).map((option) => <button type="button" role="radio" aria-checked={paymentPlan === option} key={option} onClick={() => setPaymentPlan(option)} className={cn("min-h-24 rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", paymentPlan === option && "border-primary bg-primary/10")}><span className="block font-bold">{option === "full" ? "Full payment" : "50% downpayment"}</span><span className="mt-2 block font-semibold">{formatPhp(option === "full" ? pricing.totalChargedAmount : pricing.downpaymentUpfrontAmount)}</span></button>)}</div> :
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="flex items-center gap-2 font-bold text-foreground"><CheckCircle2 className="size-5 text-primary" aria-hidden="true" />Deposit and platform fee</p>
                <p className="mt-2 text-xl font-extrabold text-foreground">{formatPhp(pricing.downpaymentUpfrontAmount)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Pay {formatPhp(pricing.downpaymentBalanceAmount)} before the appointment starts. Your provider cannot begin work until the balance is verified.</p>
              </div>}
            </section>
          ) : null}

          <section aria-labelledby="payment-method-heading">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">{isPayingRemainingBalance ? "1" : "2"}</span>
              <h3 id="payment-method-heading" className="font-semibold text-foreground">Payment method</h3>
            </div>

            {allowsPayMongo ? (
              <button
                type="button"
                role="radio"
                aria-checked={selectedMethod === "paymongo-card"}
                onClick={() => { setSelectedMethod("paymongo-card"); setSubmitError(""); }}
                className={cn(
                  "flex min-h-20 w-full items-start gap-3 rounded-xl bg-muted/45 p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedMethod === "paymongo-card" && "bg-primary/10 ring-2 ring-primary",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><CreditCard className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-foreground">Pay securely by card with PayMongo</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">{advancePaymentDescription || "Your selected time is reserved for 15 minutes while you complete the test checkout."}</span>
                </span>
              </button>
            ) : (
              <p className="rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">No payment method is available for this booking.</p>
            )}

            <div className="mt-3 flex min-h-20 items-start gap-3 rounded-xl bg-muted/35 p-4 opacity-70" role="radio" aria-checked="false" aria-disabled="true">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><WalletCards className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-bold text-foreground">GCash <Badge variant="secondary">Coming soon</Badge></span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">GCash is shown for preview only and cannot be selected yet.</span>
              </span>
            </div>

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
            {isProcessing ? "Opening checkout..." : confirmLabel}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
