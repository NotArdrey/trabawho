import { paths } from "@/app/router/routes";
import { isBookingActionNeeded, isBookingPaymentDue, isBookingTerminal } from "@/features/bookings/utils/bookingFilters";
import type { DashboardBooking } from "@/features/dashboard/domain/dashboardModel";

export interface DashboardCase {
  id: string;
  bookingId: string;
  service: string;
  status: string;
  resolution: string;
  unreadCount: number;
  updatedAt: string;
}

export interface ClientBookingAction {
  id: string;
  title: string;
  detail: string;
  href: string;
  priority: number;
  updatedAt: string;
}

export interface ClientCaseProgress {
  id: string;
  title: string;
  detail: string;
  href: string;
  attention: "reply" | "unread" | null;
}

function bookingAction(booking: DashboardBooking): ClientBookingAction | null {
  if (booking.id == null) return null;
  if (booking.refundSimulated || booking.paymentStatus === "refunded") return null;
  if (booking.paymentStatus === "pending_provider") return null;
  const status = booking.status || "";
  const canRate = Boolean(booking.canRate && ["Completed Service", "Service Stopped"].includes(status));
  if (!canRate && isBookingTerminal({ ...booking, status })) return null;
  if (!canRate && !isBookingActionNeeded({ ...booking, status }, "purchases")) return null;

  let title: string;
  let priority: number;
  if (booking.deliveryStatus === "seller_claimed" || status === "Service Delivered") {
    title = "Review completed work"; priority = 1;
  } else if (booking.cashCollectionStatus === "seller_claimed") {
    title = "Confirm cash payment"; priority = 1;
  } else if (status === "Cash Verification Denied") {
    title = "Review payment issue"; priority = 2;
  } else if (isBookingPaymentDue({ ...booking, status })) {
    title = booking.paymentStatus === "partially_paid" ? "Pay remaining balance" : "Complete booking payment"; priority = 2;
  } else if (["Reservation Expired", "Awaiting Slot Selection"].includes(status)) {
    title = "Choose a visit time"; priority = 3;
  } else if (canRate) {
    title = "Rate completed service"; priority = 4;
  } else {
    return null;
  }

  const id = String(booking.id);
  return {
    id,
    title,
    detail: `${booking.serviceType || "Service"} · ${booking.workerName || "Provider"}`,
    href: `${paths.bookings}?scope=purchases&filter=all&q=${encodeURIComponent(id)}&focus=${encodeURIComponent(id)}`,
    priority,
    updatedAt: booking.raw?.booking?.updated_at || booking.raw?.booking?.created_at || booking.requestDate || "",
  };
}

export function buildClientBookingActions(bookings: readonly DashboardBooking[]): ClientBookingAction[] {
  return bookings.map(bookingAction).filter((item): item is ClientBookingAction => item !== null)
    .sort((left, right) => left.priority - right.priority || right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
}

export function getClientCaseProgress(cases: readonly DashboardCase[]): ClientCaseProgress | null {
  const current = cases.filter((item) => item.status !== "closed" && (item.resolution !== "replacement_accepted" || item.unreadCount > 0))
    .sort((left, right) => {
      const leftPriority = left.resolution === "awaiting_client" ? 0 : left.unreadCount > 0 ? 1 : 2;
      const rightPriority = right.resolution === "awaiting_client" ? 0 : right.unreadCount > 0 ? 1 : 2;
      return leftPriority - rightPriority || right.updatedAt.localeCompare(left.updatedAt);
    })[0];
  if (!current) return null;

  const attention = current.resolution === "awaiting_client" ? "reply" : current.unreadCount > 0 ? "unread" : null;
  const title = attention === "reply" ? "Reply to support"
    : attention === "unread" ? "Read your support update"
      : current.resolution === "replacement_proposed" ? "Replacement time proposed"
        : current.resolution === "refund_pending" ? "Refund review in progress"
          : current.resolution === "refund_failed" ? "Refund review needs investigation"
            : current.resolution === "awaiting_provider" ? "Waiting for the provider"
              : "Support is reviewing your case";
  return {
    id: current.id,
    title,
    detail: `${current.service} · ${attention === "reply" ? "Your response is needed" : attention === "unread" ? `${current.unreadCount} new update${current.unreadCount === 1 ? "" : "s"}` : "Open support case"}`,
    href: `${paths.supportCases}?case=${encodeURIComponent(current.id)}${attention ? "#case-conversation" : ""}`,
    attention,
  };
}
