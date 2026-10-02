import { useCallback, useEffect, useRef, useState } from "react";
import { getBookingRefunds, processCaseRefunds, requestCaseRefund, type BookingRefund } from "../services/bookingRefunds";

export function useBookingRefunds(bookingId: string, caseId: string, onChanged?: () => void) {
  const [refunds, setRefunds] = useState<BookingRefund[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const reload = useCallback(async () => {
    setRefunds(await getBookingRefunds(bookingId));
  }, [bookingId]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const data = await getBookingRefunds(bookingId); if (active) { setRefunds(data); setError(""); } }
      catch { if (active) setError("Refund status could not be loaded. Retry to see the latest progress."); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [bookingId]);
  const run = async (action: "request" | "check" | "approve", reason?: string, expectedAmount?: number) => {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(""); setMessage("");
    try {
      if (action === "request") { await requestCaseRefund(caseId); setMessage("Refund review requested. Support must approve it before money is returned."); }
      else {
        const result = await processCaseRefunds(caseId, reason, expectedAmount);
        setMessage(result.needsRetry ? "Processing could not finish. Check the saved status and try again shortly."
          : "Refund status checked. The recorded result is shown below.");
      }
      await reload();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund status could not be updated. Please retry.");
      // Approval may have persisted before a network failure. Show authoritative records.
      try { await reload(); onChanged?.(); } catch { /* Preserve last known progress. */ }
    } finally { lock.current = false; setPending(false); setLoading(false); }
  };
  return { refunds, loading, error, message, pending, run };
}
