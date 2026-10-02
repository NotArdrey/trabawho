import { useCallback, useEffect, useState } from "react";
import { subscribeToAdminSupportActivity } from "../services/adminSupportActivity";
import { listSupportCases, type SupportCase } from "../services/adminSupportService";

export function useAdminSupportCases() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void listSupportCases().then((result) => {
      if (active) { setCases(result); setError(""); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load support cases. Try refreshing.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const reconcile = () => {
      if (active && document.visibilityState !== "hidden" && navigator.onLine) {
        setRevision((value) => value + 1);
      }
    };
    const queueRefresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reconcile, 250);
    };
    const unsubscribe = subscribeToAdminSupportActivity(queueRefresh);
    // Realtime publications may be unavailable; visible queues still reconcile.
    const interval = window.setInterval(reconcile, 15_000);
    window.addEventListener("focus", queueRefresh);
    window.addEventListener("online", queueRefresh);
    document.addEventListener("visibilitychange", queueRefresh);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", queueRefresh);
      window.removeEventListener("online", queueRefresh);
      document.removeEventListener("visibilitychange", queueRefresh);
      unsubscribe();
    };
  }, []);

  return { cases, loading, error, refresh };
}
