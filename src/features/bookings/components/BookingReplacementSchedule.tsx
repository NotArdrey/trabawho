import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck2, RefreshCw } from "lucide-react";

import { paths } from "@/app/router/routes";
import { Button } from "@/components/ui/button";
import { useBookingActivity } from "@/features/bookings/hooks/useBookingActivity";
import { getActiveReplacementSchedule, type ActiveReplacementSchedule } from "@/features/bookings/services/replacementSchedules";
import { cn } from "@/lib/utils";

const time = (value: string) => new Date(value).toLocaleString("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short",
});

export function BookingReplacementSchedule({ bookingId, className, onScheduleChange }: {
  bookingId: string; className?: string; onScheduleChange?: (schedule: ActiveReplacementSchedule | null) => void;
}) {
  const [schedule, setSchedule] = useState<ActiveReplacementSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const nextSchedule = await getActiveReplacementSchedule(bookingId);
      setSchedule(nextSchedule);
      onScheduleChange?.(nextSchedule);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Replacement schedule could not be loaded.");
    } finally { setLoading(false); }
  }, [bookingId, onScheduleChange]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  useBookingActivity(refresh, true, 30_000, "support");

  if (loading && !schedule) return <p role="status" className="sr-only">Checking replacement schedule…</p>;
  if (error) return <div role="alert" className={cn("grid w-full gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive", className)}>
    <p>{error}</p><Button type="button" variant="outline" className="w-fit" onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Retry schedule</Button>
  </div>;
  if (!schedule) return null;
  const completed = schedule.status === "completed";
  return <section aria-label="Replacement appointment" className={cn("grid w-full min-w-0 gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-left text-sm dark:border-emerald-900 dark:bg-emerald-950/25", className)}>
    <h4 className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200"><CalendarCheck2 className="size-4" aria-hidden="true" />{completed ? "Replacement visit completed" : "Confirmed replacement visit"}</h4>
    <p className="font-semibold text-foreground">{time(schedule.startAt)}–{new Date(schedule.endAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", timeStyle: "short" })}</p>
    <p className="text-muted-foreground">{completed ? "This was the agreed replacement appointment." : "This is the active appointment. The original appointment remains in booking details as history; the case stays open until this visit is completed."}</p>
    <div className="mt-1 flex flex-wrap gap-2"><Button asChild variant="outline" className="w-fit"><Link to={`${paths.supportCases}?case=${schedule.caseId}`}>
      View support case<ArrowRight aria-hidden="true" />
    </Link></Button>{!completed && <Button asChild variant="ghost" className="w-fit"><Link to={`${paths.supportCases}?case=${schedule.caseId}#case-conversation`}>Problem with this visit? Contact support</Link></Button>}</div>
  </section>;
}
