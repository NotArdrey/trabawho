import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { fetchBookingById } from "@/features/bookings/services/bookingService";
import { supabase } from "@/integrations/supabase";

interface PaymentReturnStatusProps {
  onBookingUpdated: (booking: unknown) => void;
}

type ReturnState = "cancelled" | "confirmed" | "verifying" | "delayed" | "support";

export function PaymentReturnStatus({ onBookingUpdated }: PaymentReturnStatusProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialState = searchParams.get("payment") as ReturnState | null;
  const bookingId = searchParams.get("booking");
  const attemptId = searchParams.get("attempt");
  const [state, setState] = useState<ReturnState | null>(initialState);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (initialState !== "verifying" || !bookingId || !attemptId) return undefined;
    let active = true;
    let attempts = 0;
    let timer: number | undefined;
    let reconciled = false;
    const refresh = async () => {
      let terminal = false;
      try {
        const { data: paymentAttempt, error } = await supabase.from("payment_attempts")
          .select("status, booking_id").eq("id", attemptId).eq("booking_id", bookingId).maybeSingle();
        if (error) throw error;
        if (!active) return;
        if (paymentAttempt?.status === "paid") {
          const booking = await fetchBookingById(bookingId);
          if (!active || !booking) throw new Error("Booking refresh failed");
          onBookingUpdated(booking);
          setState(["paid", "partially_paid"].includes(String(booking.paymentStatus)) ? "confirmed" : "delayed");
          return;
        }
        if (paymentAttempt?.status === "late_paid") { setState("support"); return; }
        terminal = ["failed", "expired", "cancelled"].includes(String(paymentAttempt?.status));
        attempts += 1;
        if ((terminal || attempts >= 5) && !reconciled) {
          reconciled = true;
          const result = await supabase.functions.invoke<{ verified?: boolean; latePaid?: boolean }>("reconcile-paymongo-checkout", { body: { attemptId } });
          if (!active) return;
          if (result.data?.latePaid) { setState("support"); return; }
          if (result.data?.verified) {
            const booking = await fetchBookingById(bookingId);
            if (booking && active) { onBookingUpdated(booking); setState(["paid", "partially_paid"].includes(String(booking.paymentStatus)) ? "confirmed" : "delayed"); return; }
          }
        }
        if (terminal) { setState("delayed"); return; }
      } catch {
        // A webhook can still be processing; keep the recoverable status visible.
      }
      if (terminal) { setState("delayed"); return; }
      if (active && attempts < 15) timer = window.setTimeout(refresh, 2000);
      else if (active) setState("delayed");
    };
    void refresh();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [bookingId, attemptId, initialState, onBookingUpdated, retryToken]);

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
      {confirmed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" /> : cancelled || state === "delayed" || state === "support" ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" /> : <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{confirmed ? "Payment confirmed" : state === "support" ? "Payment needs support review" : cancelled ? "Checkout cancelled" : state === "delayed" ? "Payment still unverified" : "Verifying your payment"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{confirmed ? "This checkout installment was verified by the server. Review your booking for the next step." : state === "support" ? "PayMongo verified a charge after the reservation was no longer available. The booking was not confirmed. Contact support and do not pay again." : cancelled ? "No payment was recorded. You can retry while the reservation is still active." : state === "delayed" ? "Your booking has not been marked paid. Check again shortly; if you were charged, contact support before paying again." : "Waiting for PayMongo's secure confirmation. The return page alone does not confirm payment."}</p>
        {state === "delayed" && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => { setState("verifying"); setRetryToken((value) => value + 1); }}>Check again</Button>}
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss payment status"><X className="size-4" aria-hidden="true" /></Button>
    </aside>
  );
}
