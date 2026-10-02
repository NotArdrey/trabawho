import { useEffect } from "react";
import { subscribeToBookingActivity } from "../services/bookingActivity";

export function useBookingActivity(refresh: () => Promise<unknown>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    let pending = false;
    let timer: number | undefined;
    const run = async () => {
      if (!active || document.visibilityState === "hidden" || !navigator.onLine) return;
      if (running) { pending = true; return; }
      running = true;
      try { await refresh(); }
      finally {
        running = false;
        if (pending && active) { pending = false; queueRefresh(); }
      }
    };
    const queueRefresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void run(); }, 250);
    };
    const unsubscribe = subscribeToBookingActivity(queueRefresh);
    // A connected channel can silently lack table publications. Reconcile visible screens too.
    const reconciliation = window.setInterval(() => { void run(); }, 15_000);
    window.addEventListener("focus", queueRefresh);
    window.addEventListener("online", queueRefresh);
    document.addEventListener("visibilitychange", queueRefresh);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(reconciliation);
      window.removeEventListener("focus", queueRefresh);
      window.removeEventListener("online", queueRefresh);
      document.removeEventListener("visibilitychange", queueRefresh);
      unsubscribe();
    };
  }, [enabled, refresh]);
}
