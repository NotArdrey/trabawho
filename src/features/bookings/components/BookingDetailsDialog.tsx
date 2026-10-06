import { useCallback, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  MessageCircle,
  ReceiptText,
  Star,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingReplacementSchedule } from "@/features/bookings/components/BookingReplacementSchedule";
import { BookingRefundStage } from "@/features/bookings/components/BookingRefundStage";
import { BookingServiceLocation } from './BookingServiceLocation';
import type { ActiveReplacementSchedule } from "@/features/bookings/services/replacementSchedules";
import { isShowcasePaymentReference } from "@/features/bookings/utils/bookingPaymentPresentation";
import { formatBookingCreatedAt } from "@/features/bookings/utils/bookingCreatedAt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface BookingDetails {
  raw?: { metadata?: unknown };
  clientName?: string;
  createdAt?: string | null;
  completedAt?: string;
  completionDueAt?: string;
  deliveryStatus?: string;
  description?: string;
  id: string | number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentPlan?: string;
  amountPaid?: number | string;
  upfrontRequiredAmount?: number | string;
  balanceDueAmount?: number | string;
  balanceDueAt?: string;
  workStartedAt?: string;
  warrantyEligible?: boolean;
  warrantyPolicyCode?: string | null;
  warrantyDurationDays?: number | null;
  warrantyCoverageSummary?: string | null;
  disputeStatus?: string;
  paymentReference?: string;
  refundSimulated?: boolean;
  quoteAmount?: number | string;
  rating?: number | string;
  requestDate?: string;
  review?: string;
  reviewImageUrl?: string;
  selectedSlot?: {
    date?: string;
    timeBlock?: { startTime?: string; endTime?: string };
  };
  serviceType?: string;
  totalChargedAmount?: number | string;
  transactionFeeAmount?: number | string;
  workerName?: string;
  status?: string;
}

interface BookingDetailsDialogProps {
  booking: BookingDetails | null | undefined;
  isProviderView: boolean;
  onClose: () => void;
  onMessage: (bookingId: string | number) => void;
  onPay?: (bookingId: string | number) => void;
  statusLabel: string;
}

function formatPhp(value?: number | string) {
  const amount = Number(value || 0);
  return `PHP ${amount.toLocaleString("en-PH", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string) {
  if (!value) return "Not scheduled yet";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

function formatTime(value?: string) {
  const raw = String(value || "").trim();
  if (!raw || /\b(?:am|pm)\b/i.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

function formatTimeRange(block?: { startTime?: string; endTime?: string }) {
  return block ? `${formatTime(block.startTime)} – ${formatTime(block.endTime)}` : "Coordinated in chat";
}

function paymentLabel(method?: string) {
  if (method === "paymongo-card") return "Card via PayMongo";
  if (method === "gcash-advance") return "GCash advance";
  if (method === "after-service-gcash") return "GCash after service";
  if (method === "after-service-cash") return "Cash after service";
  return "Pending selection";
}

function statusVariant(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("complete") || normalized.includes("confirmed")) return "success" as const;
  if (normalized.includes("cancel") || normalized.includes("denied")) return "destructive" as const;
  return "warning" as const;
}

interface ProgressStepProps {
  complete: boolean;
  detail: string;
  label: string;
}

function ProgressStep({ complete, detail, label }: ProgressStepProps) {
  const Icon = complete ? CheckCircle2 : Clock3;
  return (
    <div className="flex min-w-0 gap-3 py-3">
      <span className={complete ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-bold text-foreground">{detail}</p></div>
    </div>
  );
}

export function BookingDetailsDialog({ booking, isProviderView, onClose, onMessage, onPay, statusLabel }: BookingDetailsDialogProps) {
  const [replacementState, setReplacementState] = useState<{ bookingId: string; schedule: ActiveReplacementSchedule | null } | null>(null);
  const onScheduleChange = useCallback((schedule: ActiveReplacementSchedule | null) => {
    if (booking) setReplacementState({ bookingId: String(booking.id), schedule });
  }, [booking]);
  if (!booking) return null;
  const replacementActive = replacementState?.bookingId === String(booking.id)
    && replacementState.schedule?.status !== "completed" && Boolean(replacementState.schedule);
  const demoPayment = isShowcasePaymentReference(booking.paymentReference);
  const providerComplete = ["seller_claimed", "buyer_confirmed"].includes(booking.deliveryStatus || "");
  const clientComplete = booking.deliveryStatus === "buyer_confirmed";
  const clientDetail = clientComplete ? "Completed" : booking.deliveryStatus === "seller_claimed" ? "Awaiting client" : "Waiting for delivery";
  const total = booking.totalChargedAmount || booking.quoteAmount || 0;
  const normalizedStatus = statusLabel.toLowerCase();
  const cancelled = normalizedStatus.includes("cancel") || normalizedStatus.includes("refund");
  const paymentDue = !cancelled && (["unpaid", "pending", "pending_provider", "partially_paid"].includes(booking.paymentStatus || "")
    || normalizedStatus.includes("payment pending"));
  const completed = normalizedStatus.includes("complete") || clientComplete;
  const nextStep = cancelled
    ? booking.refundSimulated
      ? { title: "Visit cancelled; refund review complete", detail: "Support closed the review in test mode. PayMongo did not return money.", complete: false }
      : booking.paymentStatus === "refund_pending"
        ? { title: "Visit cancelled; refund review in progress", detail: "The time is released. Support is verifying the payment separately; no money has been returned.", complete: false }
        : { title: "This booking is no longer active", detail: "The appointment was cancelled and its time released.", complete: false }
    : replacementActive
    ? { title: "Replacement visit confirmed", detail: "The agreed new appointment is active. The support case stays open until replacement work is completed and confirmed.", complete: true }
    : booking.disputeStatus === "open"
    ? { title: "Support case open", detail: "Completion is paused while the case is reviewed. Check the support case for messages, a replacement visit, or refund progress.", complete: false }
    : completed
      ? { title: "Service completed", detail: "The appointment and payment details below are your booking record.", complete: true }
      : paymentDue
        ? { title: isProviderView ? "Waiting for client payment" : booking.paymentStatus === "partially_paid" ? "Pay the balance before work" : "Deposit required to confirm", detail: isProviderView ? "The client must complete the balance checkout before work can begin." : booking.paymentStatus === "partially_paid" ? "Your schedule is confirmed; pay the remaining balance before the appointment starts." : "Pay the 50% deposit to keep this appointment reserved.", complete: false }
        : { title: isProviderView ? "Prepare for the appointment" : "Your appointment is confirmed", detail: isProviderView ? "Use the schedule below and message the client if coordination is needed." : "Review the schedule below and message the provider if anything changes.", complete: true };
  const NextStepIcon = nextStep.complete ? CheckCircle2 : Clock3;
  const bookedOn = formatBookingCreatedAt(booking.createdAt);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100svh-1rem)] max-w-2xl gap-0 overflow-y-auto p-0 sm:max-h-[calc(100svh-2rem)]">
        <DialogHeader className="bg-muted/45 px-5 py-5 pr-16 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ReceiptText className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-primary">Booking details</span><Badge variant={statusVariant(statusLabel)}>{statusLabel}</Badge><BookingRefundStage booking={{ status: booking.status || statusLabel, paymentStatus: booking.paymentStatus, refundSimulated: booking.refundSimulated }} /></div>
              <DialogTitle className="text-2xl">{booking.serviceType || "Service booking"}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5"><UserRound className="size-4" aria-hidden="true" />{isProviderView ? booking.clientName : booking.workerName}</DialogDescription>
              {bookedOn ? <p className="mt-2 text-sm text-muted-foreground">Booked on <time dateTime={booking.createdAt || undefined} className="font-semibold text-foreground">{bookedOn}</time></p> : null}
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 px-4 py-5 sm:px-6">
          <BookingServiceLocation metadata={booking.raw?.metadata} />
          <section className={nextStep.complete ? "flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40" : "flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"} aria-labelledby="booking-next-step-heading">
            <span className={nextStep.complete ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"}>
              <NextStepIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What happens next</p>
              <h3 id="booking-next-step-heading" className="mt-1 font-bold text-foreground">{nextStep.title}</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{nextStep.detail}</p>
            </div>
          </section>

          {["open", "closed"].includes(booking.disputeStatus || "") && <BookingReplacementSchedule bookingId={String(booking.id)} onScheduleChange={onScheduleChange} />}
          <section className="rounded-xl border bg-card p-4" aria-labelledby="booking-schedule-heading">
            <div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" aria-hidden="true" /><h3 id="booking-schedule-heading" className="font-bold text-foreground">{replacementActive ? "Original booking appointment" : "Appointment"}</h3></div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visit date</dt><dd className="mt-1 text-base font-bold text-foreground">{formatDate(booking.selectedSlot?.date)}</dd></div>
              <div className="sm:text-right"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visit time</dt><dd className="mt-1 text-base font-bold text-foreground">{formatTimeRange(booking.selectedSlot?.timeBlock)}</dd></div>
            </dl>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border bg-card p-4" aria-labelledby="booking-payment-heading">
              <div className="flex items-center gap-2"><CreditCard className="size-5 text-primary" aria-hidden="true" /><h3 id="booking-payment-heading" className="font-bold text-foreground">Payment</h3></div>
              <dl className="mt-3 divide-y">
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">Method</dt><dd className="text-right text-sm font-bold text-foreground">{demoPayment ? "Demo booking — no charge" : paymentLabel(booking.paymentMethod)}</dd></div>
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">{isProviderView ? "Booking amount" : "Service price"}</dt><dd className="font-bold text-foreground">{formatPhp(booking.quoteAmount)}</dd></div>
                {!isProviderView && Number(booking.transactionFeeAmount || 0) > 0 ? <div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">Platform fee</dt><dd className="font-bold text-foreground">{formatPhp(booking.transactionFeeAmount)}</dd></div> : null}
                {booking.paymentPlan === "downpayment" && <><div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">Deposit + platform fee</dt><dd className="font-bold text-foreground">{formatPhp(booking.upfrontRequiredAmount)}</dd></div><div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">Verified paid</dt><dd className="font-bold text-emerald-700 dark:text-emerald-300">{formatPhp(booking.amountPaid)}</dd></div>{!cancelled && <div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">Balance before work</dt><dd className="font-bold text-foreground">{formatPhp(booking.balanceDueAmount)}</dd></div>}</>}
                {!isProviderView ? <div className="flex items-end justify-between gap-3 py-3"><dt className="text-sm font-semibold text-foreground">{demoPayment ? "Illustrative total" : paymentDue ? "Total payment" : "Total charged"}</dt><dd className={demoPayment ? "text-lg font-extrabold text-foreground" : "text-lg font-extrabold text-emerald-700 dark:text-emerald-300"}>{formatPhp(total)}</dd></div> : null}
              </dl>
            </section>

            <section className="rounded-xl border bg-card px-4 py-3" aria-labelledby="booking-progress-heading">
              <h3 id="booking-progress-heading" className="pt-1 font-bold text-foreground">Service progress</h3>
              <div className="mt-1 divide-y">
              {booking.paymentPlan === "downpayment" && <ProgressStep label="Verified payment" complete={booking.paymentStatus === "paid"} detail={booking.paymentStatus === "paid" ? "Balance fully paid" : booking.paymentStatus === "partially_paid" ? "Deposit paid; balance due" : "Awaiting deposit"} />}
              {booking.paymentPlan === "downpayment" && <ProgressStep label="Work started" complete={Boolean(booking.workStartedAt)} detail={booking.workStartedAt ? "Provider started work" : "Waiting for full payment and appointment"} />}
              <ProgressStep label="Provider confirmation" complete={providerComplete} detail={providerComplete ? "Delivery confirmed" : "Awaiting provider"} />
                <ProgressStep label="Client confirmation" complete={clientComplete} detail={clientDetail} />
              </div>
            </section>
          </div>

          {booking.paymentReference ? <section className="flex gap-3 rounded-xl bg-primary/5 p-4" aria-labelledby="booking-reference-heading"><FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><h3 id="booking-reference-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{demoPayment ? "Demo booking reference" : booking.paymentReference.startsWith("pay_") ? "PayMongo payment ID" : "Payment reference"}</h3><p className="mt-1 break-all font-mono text-sm font-bold text-foreground">{booking.paymentReference}</p></div></section> : null}
          {booking.completedAt ? <p className="text-sm text-muted-foreground">Completed on <strong className="text-foreground">{new Date(booking.completedAt).toLocaleDateString("en-PH")}</strong></p> : null}
          {!cancelled && booking.paymentPlan === "downpayment" && booking.balanceDueAt && Number(booking.balanceDueAmount || 0) > 0 && <p className="text-sm text-muted-foreground">Balance due before <strong className="text-foreground">{new Date(booking.balanceDueAt).toLocaleString("en-PH")}</strong>.</p>}
          {booking.completionDueAt && booking.deliveryStatus === "seller_claimed" && <p className="text-sm text-muted-foreground">Client review ends {new Date(booking.completionDueAt).toLocaleString("en-PH")} if no case is open.</p>}
          {booking.warrantyPolicyCode === "repair_workmanship_7d" && <p className="text-sm text-muted-foreground">Designated repair-workmanship reporting: <strong className="text-foreground">{booking.warrantyDurationDays || 7} days after completion</strong>{booking.completedAt ? `, through ${new Date(new Date(booking.completedAt).getTime() + (booking.warrantyDurationDays || 7) * 24 * 60 * 60_000).toLocaleString("en-PH")}` : ""}. {booking.warrantyCoverageSummary || "In-window reports request rework; exceptions receive support review."} No refund is automatic.</p>}
          {booking.warrantyEligible && !booking.warrantyPolicyCode && <p className="text-sm text-muted-foreground">This earlier booking has a legacy repair-issue report flag. Any report will receive support review; no automatic rework or refund is promised.</p>}
          {isProviderView && <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">Provider payout: not processed in this test flow.</p>}
          {booking.description ? <section className="rounded-xl bg-muted/40 p-4"><h3 className="font-bold text-foreground">Service notes</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.description}</p></section> : null}
          {booking.rating || booking.review ? <section className="rounded-xl bg-brand-highlight-soft/50 p-4"><h3 className="flex items-center gap-2 font-bold text-foreground"><Star className="size-4 fill-brand-highlight text-brand-highlight" aria-hidden="true" />Customer review{booking.rating ? ` · ${booking.rating}/5` : ""}</h3>{booking.review ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.review}</p> : null}{booking.reviewImageUrl ? <img className="mt-3 max-h-56 rounded-lg object-cover" src={booking.reviewImageUrl} alt="Customer review" /> : null}</section> : null}
        </div>

        <DialogFooter className="sticky bottom-0 border-t bg-background px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" variant={paymentDue && !isProviderView && onPay ? "outline" : "primary"} onClick={() => onMessage(booking.id)}><MessageCircle aria-hidden="true" />{isProviderView ? "Message client" : "Message provider"}</Button>
          {paymentDue && !isProviderView && onPay ? <Button type="button" onClick={() => onPay(booking.id)}><CreditCard aria-hidden="true" />{booking.paymentStatus === "partially_paid" ? "Pay balance" : "Pay now"}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
