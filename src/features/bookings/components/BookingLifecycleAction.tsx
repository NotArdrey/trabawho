import { useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  performBookingLifecycleAction,
  type BookingLifecycleAction as LifecycleAction,
} from "@/features/bookings/services/bookingLifecycle";

interface BookingRecord {
  id: string;
  status?: string;
  scheduleStatus?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  disputeStatus?: string;
  raw?: { booking?: { status?: string } };
}

interface BookingLifecycleActionProps {
  booking: BookingRecord;
  viewerRole: "client" | "provider";
  onUpdated: (booking: unknown) => void;
  onSuccess: (action: LifecycleAction) => void;
  onError: (action: LifecycleAction, message: string) => void;
}

function getAvailableAction(booking: BookingRecord, role: "client" | "provider"): LifecycleAction | null {
  const rawStatus = booking.raw?.booking?.status;
  const active = rawStatus
    ? rawStatus === "confirmed" || rawStatus === "in_progress"
    : ["Payment Confirmed", "Service Scheduled", "Active Service", "Service Delivered"].includes(booking.status ?? "");
  if (!active || booking.paymentStatus !== "paid" || booking.disputeStatus === "open") return null;
  if (booking.scheduleStatus && booking.scheduleStatus !== "confirmed") return null;
  if (role === "provider" && booking.deliveryStatus === "not_delivered") return "deliver";
  if (role === "client" && booking.deliveryStatus === "seller_claimed") return "complete";
  return null;
}

export function BookingLifecycleAction({
  booking,
  viewerRole,
  onUpdated,
  onSuccess,
  onError,
}: BookingLifecycleActionProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const action = getAvailableAction(booking, viewerRole);

  if (!action) {
    if (booking.disputeStatus === "open") return null;
    if (booking.paymentStatus === "paid" && booking.deliveryStatus === "seller_claimed" && viewerRole === "provider") {
      return <span className="self-center text-sm text-muted-foreground">Waiting for client confirmation</span>;
    }
    if (booking.paymentStatus === "paid" && booking.deliveryStatus === "not_delivered" && viewerRole === "client") {
      return <span className="self-center text-sm text-muted-foreground">Waiting for provider delivery</span>;
    }
    return null;
  }

  const handleClick = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const refreshed = await performBookingLifecycleAction(action, booking.id);
      onUpdated(refreshed);
      onSuccess(action);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "This booking could not be updated. Please try again.";
      setError(message);
      onError(action, message);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <div className="col-span-2 grid gap-1 sm:col-auto">
      <Button type="button" disabled={pending} aria-busy={pending} onClick={() => { void handleClick(); }}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
        {pending ? "Saving…" : action === "deliver" ? "Mark Delivered" : "Confirm Completion"}
      </Button>
      {error && <p role="alert" className="max-w-80 text-sm text-destructive">{error}</p>}
    </div>
  );
}
