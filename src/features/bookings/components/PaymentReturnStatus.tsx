import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { fetchBookingById } from "@/features/bookings/services/bookingService";

interface PaymentReturnStatusProps {
  onBookingUpdated: (booking: unknown) => void;
}

type ReturnState = "cancelled" | "confirmed" | "verifying";

export function PaymentReturnStatus({ onBookingUpdated }: PaymentReturnStatusProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialState = searchParams.get("payment") as ReturnState | null;
  const bookingId = searchParams.get("booking");
  const [state, setState] = useState<ReturnState | null>(initialState);

  useEffect(() => {
    if (initialState !== "verifying" || !bookingId) return undefined;
    let active = true;
    let attempts = 0;
    const refresh = async () => {
      try {
        const booking = await fetchBookingById(bookingId);
        if (!active || !booking) return;
        onBookingUpdated(booking);
        if (["paid", "partially_paid"].includes(String(booking.paymentStatus))) {
          setState("confirmed");
          return;
        }
      } catch {
        // A webhook can still be processing; keep the recoverable status visible.
      }
      attempts += 1;
      if (active && attempts < 15) window.setTimeout(refresh, 2000);
    };
    void refresh();
    return () => { active = false; };
  }, [bookingId, initialState, onBookingUpdated]);

  if (!state) return null;
  const dismiss = () => {
    const next = new URLSearchParams(searchParams);
    ["payment", "booking", "attempt"].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
    setState(null);
  };
  const confirmed = state === "confirmed";
  const cancelled = state === "cancelled";

  return (
    <aside className="fixed inset-x-3 top-3 z-[1200] mx-auto flex max-w-xl items-start gap-3 rounded-xl border bg-background p-4 shadow-xl sm:inset-x-auto sm:right-5 sm:top-5" role={confirmed ? "status" : "alert"} aria-live="polite">
      {confirmed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" /> : cancelled ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" /> : <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{confirmed ? "Payment confirmed" : cancelled ? "Checkout cancelled" : "Verifying your payment"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{confirmed ? "Your booking and reserved schedule are confirmed." : cancelled ? "No payment was recorded. You can retry while the reservation is still active." : "PayMongo is sending the result securely. This usually takes only a few seconds."}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss payment status"><X className="size-4" aria-hidden="true" /></Button>
    </aside>
  );
}
