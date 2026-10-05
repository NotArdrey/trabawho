import {
  AlertCircle, CalendarCheck, CalendarDays, CalendarX2, CheckCircle2,
  Clock, CreditCard, MessageCircle, RotateCcw, ShieldCheck,
} from "lucide-react";

export function getStatusMeta(status: string) {
  if (status === "Completed Service") return { className: "booking-status-completed", icon: CheckCircle2, label: "Completed" };
  if (status === "Service Scheduled" || status === "Payment Confirmed") {
    return { className: "booking-status-completed", icon: ShieldCheck, label: status };
  }
  if (status === "Payment Pending" || status === "Slot Selected - Payment Pending") {
    return { className: "booking-status-pending", icon: CreditCard, label: "Payment Pending" };
  }
  if (status === "Cash Verification Pending") return { className: "booking-status-pending", icon: Clock, label: "Cash Verification" };
  if (status === "Refund Simulated") {
    return { className: "booking-status-completed", icon: CheckCircle2, label: "Refund review complete" };
  }
  if (status === "Refund Processing" || status === "Refunded") {
    return { className: "booking-status-cancelled", icon: RotateCcw, label: status };
  }
  if (status === "Refund Pending" || status === "Cancellation Requested") {
    return { className: "booking-status-pending", icon: Clock, label: status };
  }
  if (status === "Reservation Expired") return { className: "booking-status-pending", icon: CalendarX2, label: "Choose New Time" };
  if (status === "Cancelled" || status === "Cancelled (Cash)") {
    return { className: "booking-status-cancelled", icon: AlertCircle, label: "Cancelled" };
  }
  if (status === "Awaiting Slot Selection") return { className: "booking-status-active", icon: CalendarDays, label: "Select Slot" };
  if (status === "Negotiating") return { className: "booking-status-active", icon: MessageCircle, label: "Negotiating" };
  return { className: "booking-status-active", icon: CalendarCheck, label: status || "Active" };
}
