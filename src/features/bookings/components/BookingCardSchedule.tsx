import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock, CreditCard, Receipt } from "lucide-react";

import { useBookingActivity } from "@/features/bookings/hooks/useBookingActivity";
import { getActiveReplacementSchedule, type ActiveReplacementSchedule } from "@/features/bookings/services/replacementSchedules";
import { isShowcasePaymentReference } from "@/features/bookings/utils/bookingPaymentPresentation";
import { cn } from "@/lib/utils";

interface BookingCardScheduleProps {
  bookingId: string;
  checkReplacement: boolean;
  originalDate?: string;
  originalTime: string;
  paymentMethod?: string;
  paymentReference?: string;
}

const visitDate = (value: string) => new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
});
const visitTime = (value: string) => new Date(value).toLocaleTimeString("en-PH", {
  timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit",
});

function paymentLabel(method?: string) {
  switch (method) {
    case "paymongo-card": return "PayMongo Card";
    case "gcash-advance": return "Legacy GCash";
    case "after-service-cash": return "Cash on Meetup";
    case "after-service-gcash": return "GCash on Meetup";
    default: return "Pending Selection";
  }
}

export function BookingCardSchedule({ bookingId, checkReplacement, originalDate, originalTime,
  paymentMethod, paymentReference }: BookingCardScheduleProps) {
  const demoPayment = isShowcasePaymentReference(paymentReference);
  const [schedule, setSchedule] = useState<ActiveReplacementSchedule | null>(null);
  const replacementCompleted = schedule?.status === "completed";
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(checkReplacement);
  const refresh = useCallback(async () => {
    if (!checkReplacement) return;
    try {
      setSchedule(await getActiveReplacementSchedule(bookingId));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }, [bookingId, checkReplacement]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  useBookingActivity(refresh, checkReplacement, 30_000, "support");

  return <div className={cn("booking-details-grid border", schedule
    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
    : "border-orange-200 dark:border-orange-800/60")}>
    <div className="booking-detail-item">
      <CalendarDays size={16} aria-hidden="true" />
      <div><span>{replacementCompleted ? "Completed visit date: " : schedule ? "Active visit date: " : "Date: "}</span>
        <strong>{schedule ? visitDate(schedule.startAt) : checking ? "Checking current visit…" : originalDate || "Coordinated in chat"}</strong></div>
    </div>
    <div className="booking-detail-item">
      <Clock size={16} aria-hidden="true" />
      <div><span>{replacementCompleted ? "Completed visit time: " : schedule ? "Active visit time: " : "Time: "}</span>
        <strong>{schedule ? `${visitTime(schedule.startAt)}–${visitTime(schedule.endAt)} PHT` : checking ? "Checking current visit…" : originalTime}</strong></div>
    </div>
    <div className="booking-detail-item">
      <CreditCard size={16} aria-hidden="true" />
      <div><span>Payment: </span><strong>{demoPayment ? "Demo booking — no charge" : paymentLabel(paymentMethod)}</strong></div>
    </div>
    {paymentReference && <div className="booking-detail-item">
      <Receipt size={16} aria-hidden="true" />
      <div><span>{demoPayment ? "Demo ID: " : paymentReference.startsWith("pay_") ? "PayMongo ID: " : "Ref: "}</span><code className="booking-reference">{paymentReference}</code></div>
    </div>}
    {error && <p role="alert" className="col-span-full text-xs text-destructive">
      {schedule ? "The latest visit update could not be checked. Confirm the time in your support case."
        : "The current visit could not be checked. Open the support case before relying on the original date above."}
    </p>}
  </div>;
}
