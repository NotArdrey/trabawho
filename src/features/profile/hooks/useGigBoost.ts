import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getActiveAdBooster } from "@/shared/utils/serviceBoost";
import { createBoostCheckout, fetchBoostServices, forgetBoostCheckoutOperations, verifyBoostCheckout, type BoostService } from "../services/gigBoostService";
import { completeLocalSandboxCheckout, ensureLocalSandboxReady } from "@/shared/services/paymongoSandboxCheckout";
import { buildBoostDraft, calculateBoostTotal, getBoostDailyRate, validateBoostSettings, type BoostDraft } from "../utils/gigBoost";

export function useGigBoost(sellerId?: string) {
  const [params, setParams] = useSearchParams();
  const [services, setServices] = useState<BoostService[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [days, setDays] = useState("7");
  let dailyRate = 0;
  let pricingError = "";
  try { dailyRate = getBoostDailyRate(); }
  catch (failure) { pricingError = failure instanceof Error ? failure.message : "Ad booster pricing is unavailable."; }
  const total = !validateBoostSettings(days).days && !pricingError ? calculateBoostTotal(Number(days), dailyRate) : null;
  const [draft, setDraft] = useState<BoostDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"info" | "warning" | "success">("info");
  const [clock, setClock] = useState(Date.now);
  const submitLock = useRef(false);
  const attemptId = params.get("boostAttempt");
  const returnStatus = params.get("boostPayment");
  const reload = useCallback(async () => {
    if (!sellerId) return;
    const rows = await fetchBoostServices(sellerId);
    setServices(rows);
    setSelectedId((previous) => rows.some((row) => String(row.id) === previous) ? previous : String(rows[0]?.id || ""));
  }, [sellerId]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await Promise.resolve();
      if (!mounted) return;
      setLoading(true);
      setServices([]);
      if (!sellerId) { setLoading(false); return; }
      try {
        const rows = await fetchBoostServices(sellerId);
        if (!mounted) return;
        setServices(rows);
        setSelectedId(String(rows[0]?.id || ""));
      } catch { if (mounted) setError("Unable to load your gigs. Please retry."); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [sellerId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sellerId || !attemptId || !returnStatus) return;
    let cancelled = false;
    let timer: number | undefined;
    let checks = 0;
    const clearReturn = () => setParams((previous) => { const next = new URLSearchParams(previous); next.delete("boostPayment"); next.delete("boostAttempt"); return next; }, { replace: true });
    const verify = async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) { setError("Invalid boost payment link."); setVerifying(false); return; }
      setVerifying(true);
      setError("");
      if (checks === 0) { setMessageKind("info"); setMessage("Waiting for PayMongo to confirm your payment..."); }
      try {
        const result = await verifyBoostCheckout(attemptId);
        if (cancelled) return;
        if (result.verified) {
          await reload();
          if (cancelled) return;
          setSelectedId(String(result.serviceId));
          setClock(Date.now());
          const stillActive = result.endsAt !== null && Date.parse(result.endsAt) > Date.now();
          setMessage(stillActive
            ? "Payment verified. Your gig boost is active in marketplace recommendations."
            : "Payment verified. This boost has ended. You can purchase a new boost.");
          setMessageKind(stillActive ? "success" : "warning");
          setVerifying(false);
          clearReturn();
          return;
        }
        if (result.requiresReview) {
          setError("Payment received. Contact support to review this gig before activation.");
          setMessage(""); setVerifying(false); return;
        }
        if (returnStatus === "cancelled" || ["failed", "expired"].includes(result.status)) {
          forgetBoostCheckoutOperations(sellerId);
          setMessageKind("warning");
          setMessage(returnStatus === "cancelled" ? "Checkout cancelled. Your gig boost is inactive. You can review the payment and try again." : "Payment was not completed. Your gig boost is inactive. You can review the payment and try again.");
          setVerifying(false); clearReturn(); return;
        }
        checks++;
        if (checks >= 20) { setMessageKind("info"); setMessage("Still waiting for PayMongo confirmation. Your boost remains inactive; this page will update automatically. Do not pay again while confirmation is pending."); }
        timer = window.setTimeout(() => { void verify(); }, checks < 20 ? 3000 : 30_000);
      } catch (failure) {
        if (!cancelled) {
          setError(failure instanceof Error ? `${failure.message} Retrying automatically.` : "Payment status is temporarily unavailable. Retrying automatically.");
          setMessage(""); timer = window.setTimeout(() => { void verify(); }, 30_000);
        }
      }
    };
    void verify();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [attemptId, returnStatus, sellerId, reload, setParams]);

  const selected = services.find((service) => String(service.id) === selectedId);
  const boost = getActiveAdBooster(selected, clock);
  const review = () => {
    try {
      if (boost.isBoosted) throw new Error("This gig already has an active paid boost.");
      setDraft(buildBoostDraft(selectedId, selected?.title || "Selected gig", days));
      setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Check your boost settings."); }
  };
  const checkout = async (oneClickTest = false) => {
    if (!draft || !sellerId || submitLock.current) return;
    submitLock.current = true; setSaving(true); setError("");
    try {
      if (oneClickTest) await ensureLocalSandboxReady();
      const result = await createBoostCheckout(sellerId, draft);
      if (oneClickTest) await completeLocalSandboxCheckout(result.checkoutUrl, result.checkoutSessionId);
      else window.location.assign(result.checkoutUrl);
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to start checkout."); }
    finally { submitLock.current = false; setSaving(false); }
  };
  const retryLoad = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try { await reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load your gigs. Please retry."); }
    finally { setLoading(false); }
  };
  return { services, selectedId, setSelectedId, days, setDays, dailyRate, total, pricingError, draft, loading, saving, verifying,
    error, message, messageKind, boost, clock, review, checkout, cancel: () => { if (!saving) { setDraft(null); setError(""); } },
    retryLoad };
}
