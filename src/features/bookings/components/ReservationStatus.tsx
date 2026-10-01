import { useEffect, useState } from "react";
import { AlertCircle, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ReservationStatusProps {
  actionLabel?: string;
  expiresAt?: string | null;
  onChooseAnotherTime?: () => void;
  scheduleStatus?: string | null;
}

const formatRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export function ReservationStatus({
  actionLabel = "Choose another time",
  expiresAt,
  onChooseAnotherTime,
  scheduleStatus,
}: ReservationStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt || scheduleStatus !== "held") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, scheduleStatus]);

  const remaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const passed = scheduleStatus === "passed";
  const expired = passed || scheduleStatus === "expired" || (scheduleStatus === "held" && remaining <= 0);
  const announcement = expired
    ? "Your reservation expired."
    : remaining <= 60_000
      ? "One minute remaining to complete payment."
      : remaining <= 300_000
        ? "Five minutes remaining to complete payment."
        : "";

  if (scheduleStatus !== "held" && !expired) return null;

  if (expired) {
    return (
      <section className="mt-4 flex flex-col gap-3 rounded-xl bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" aria-labelledby="reservation-expired-title">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h4 id="reservation-expired-title" className="font-bold">{passed ? "Scheduled time has passed" : "Reservation expired"}</h4>
            <p className="mt-1 text-sm leading-5">{passed ? "Payment is unavailable for a past appointment. Choose another available time to continue with this booking." : "Your request and quote are saved. Choose another available time to continue."}</p>
          </div>
        </div>
        {onChooseAnotherTime ? <Button type="button" className="self-start" onClick={onChooseAnotherTime}>{actionLabel}</Button> : null}
        <span className="sr-only" aria-live="polite">{announcement}</span>
      </section>
    );
  }

  const expiryLabel = expiresAt
    ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(expiresAt))
    : "soon";

  return (
    <section className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-primary/8 p-4" aria-labelledby="reservation-held-title">
      <div className="flex min-w-0 items-start gap-3">
        <Clock3 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h4 id="reservation-held-title" className="font-bold text-foreground">Time reserved for payment</h4>
          <p className="mt-1 text-sm text-muted-foreground">Complete checkout by {expiryLabel}. Your request remains saved if time runs out.</p>
        </div>
      </div>
      <output className="shrink-0 rounded-lg bg-background px-3 py-2 font-mono text-lg font-bold text-primary" aria-label={`${formatRemaining(remaining)} remaining`}>
        {formatRemaining(remaining)}
      </output>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </section>
  );
}
