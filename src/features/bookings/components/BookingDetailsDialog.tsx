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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface BookingDetails {
  clientName?: string;
  completedAt?: string;
  deliveryStatus?: string;
  description?: string;
  id: string | number;
  paymentMethod?: string;
  paymentReference?: string;
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
}

interface BookingDetailsDialogProps {
  booking: BookingDetails | null | undefined;
  isProviderView: boolean;
  onClose: () => void;
  onMessage: (bookingId: string | number) => void;
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
  if (!value) return "Coordinated in chat";
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

export function BookingDetailsDialog({ booking, isProviderView, onClose, onMessage, statusLabel }: BookingDetailsDialogProps) {
  if (!booking) return null;
  const providerComplete = ["seller_claimed", "buyer_confirmed"].includes(booking.deliveryStatus || "");
  const clientComplete = booking.deliveryStatus === "buyer_confirmed";
  const clientDetail = clientComplete ? "Completed" : booking.deliveryStatus === "seller_claimed" ? "Awaiting client" : "Waiting for delivery";
  const total = booking.totalChargedAmount || booking.quoteAmount || 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100svh-1rem)] max-w-2xl gap-0 overflow-y-auto p-0 sm:max-h-[calc(100svh-2rem)]">
        <DialogHeader className="bg-muted/45 px-5 py-5 pr-16 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ReceiptText className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-primary">Booking details</span><Badge variant={statusVariant(statusLabel)}>{statusLabel}</Badge></div>
              <DialogTitle className="text-2xl">{booking.serviceType || "Service booking"}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5"><UserRound className="size-4" aria-hidden="true" />{isProviderView ? booking.clientName : booking.workerName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 px-4 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl bg-muted/40 p-4" aria-labelledby="booking-schedule-heading">
              <div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" aria-hidden="true" /><h3 id="booking-schedule-heading" className="font-bold text-foreground">Schedule</h3></div>
              <dl className="mt-3 divide-y">
                <div className="py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</dt><dd className="mt-1 font-bold text-foreground">{formatDate(booking.selectedSlot?.date || booking.requestDate)}</dd></div>
                <div className="py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</dt><dd className="mt-1 font-bold text-foreground">{formatTimeRange(booking.selectedSlot?.timeBlock)}</dd></div>
              </dl>
            </section>

            <section className="rounded-xl bg-muted/40 p-4" aria-labelledby="booking-payment-heading">
              <div className="flex items-center gap-2"><CreditCard className="size-5 text-primary" aria-hidden="true" /><h3 id="booking-payment-heading" className="font-bold text-foreground">Payment</h3></div>
              <dl className="mt-3 divide-y">
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">Method</dt><dd className="text-right text-sm font-bold text-foreground">{paymentLabel(booking.paymentMethod)}</dd></div>
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">{isProviderView ? "Booking amount" : "Service price"}</dt><dd className="font-bold text-foreground">{formatPhp(booking.quoteAmount)}</dd></div>
                {!isProviderView && Number(booking.transactionFeeAmount || 0) > 0 ? <div className="flex justify-between gap-3 py-2.5"><dt className="text-sm text-muted-foreground">Platform fee</dt><dd className="font-bold text-foreground">{formatPhp(booking.transactionFeeAmount)}</dd></div> : null}
                {!isProviderView ? <div className="flex items-end justify-between gap-3 py-3"><dt className="text-sm font-semibold text-foreground">Total charged</dt><dd className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{formatPhp(total)}</dd></div> : null}
              </dl>
            </section>
          </div>

          <section className="rounded-xl bg-muted/40 px-4 py-3" aria-labelledby="booking-progress-heading">
            <h3 id="booking-progress-heading" className="pt-1 font-bold text-foreground">Confirmation progress</h3>
            <div className="mt-1 grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <ProgressStep label="Provider confirmation" complete={providerComplete} detail={providerComplete ? "Delivery confirmed" : "Awaiting provider"} />
              <div className="sm:pl-4"><ProgressStep label="Client confirmation" complete={clientComplete} detail={clientDetail} /></div>
            </div>
          </section>

          {booking.paymentReference ? <section className="flex gap-3 rounded-xl bg-primary/5 p-4" aria-labelledby="booking-reference-heading"><FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><h3 id="booking-reference-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment reference</h3><p className="mt-1 break-all font-mono text-sm font-bold text-foreground">{booking.paymentReference}</p></div></section> : null}
          {booking.completedAt ? <p className="text-sm text-muted-foreground">Completed on <strong className="text-foreground">{new Date(booking.completedAt).toLocaleDateString("en-PH")}</strong></p> : null}
          {booking.description ? <section className="rounded-xl bg-muted/40 p-4"><h3 className="font-bold text-foreground">Service notes</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.description}</p></section> : null}
          {booking.rating || booking.review ? <section className="rounded-xl bg-brand-highlight-soft/50 p-4"><h3 className="flex items-center gap-2 font-bold text-foreground"><Star className="size-4 fill-brand-highlight text-brand-highlight" aria-hidden="true" />Customer review{booking.rating ? ` · ${booking.rating}/5` : ""}</h3>{booking.review ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.review}</p> : null}{booking.reviewImageUrl ? <img className="mt-3 max-h-56 rounded-lg object-cover" src={booking.reviewImageUrl} alt="Customer review" /> : null}</section> : null}
        </div>

        <DialogFooter className="sticky bottom-0 bg-background px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" onClick={() => onMessage(booking.id)}><MessageCircle aria-hidden="true" />{isProviderView ? "Message client" : "Message provider"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
