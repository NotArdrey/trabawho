import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBookingActivity } from "@/features/bookings/hooks/useBookingActivity";
import { getLatestReplacement } from "@/features/bookings/services/caseWorkflow";
import { AdminReplacementProposal } from "./AdminReplacementProposal";

type Detail = Awaited<ReturnType<typeof getLatestReplacement>>;

export function AdminReplacementWorkflow({ caseId, serviceId, providerId, readOnly = false, onSaved }: {
  caseId: string; serviceId: number; providerId: string; readOnly?: boolean; onSaved: () => void;
}) {
  const [detail, setDetail] = useState<Detail>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { setDetail(await getLatestReplacement(caseId)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Replacement visit could not be loaded."); }
    finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  useBookingActivity(refresh, true, 30_000, "support");

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Checking replacement visit…</p>;
  if (error) return <div role="alert" className="grid gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><p>{error}</p><Button type="button" variant="outline" className="w-fit" onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Retry visit</Button></div>;
  const visit = detail?.visit;
  const canPropose = !readOnly && (!visit || ["declined", "unavailable"].includes(visit.status));
  return <div className="grid gap-4">
    {visit && <section aria-label="Replacement visit progress" className="grid gap-2 rounded-lg bg-primary/5 p-4 text-sm">
      <h3 className="flex items-center gap-2 font-semibold text-primary"><CalendarCheck2 className="size-4" aria-hidden="true" />Replacement visit {visit.status.replaceAll("_", " ")}</h3>
      {detail?.slot && <p className="font-medium">{new Date(detail.slot.start_ts).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short" })}</p>}
      {visit.status === "proposed" && <p>Client: {visit.client_accepted_at ? "Accepted" : "Awaiting response"} · Provider: {visit.provider_accepted_at ? "Accepted" : "Awaiting response"}. The slot is not reserved until both accept.</p>}
      {visit.status === "accepted" && <p>Both participants accepted. The provider can start work near the confirmed time after full payment is verified.</p>}
      {visit.status === "delivered" && <p>Replacement work was submitted. Waiting for the client to confirm completion.</p>}
      {visit.status === "unavailable" && <p>The proposed time became unavailable. Offer another future time.</p>}
      {visit.status === "declined" && <p>A participant declined this time. Review their response before offering another.</p>}
    </section>}
    {canPropose && <AdminReplacementProposal caseId={caseId} serviceId={serviceId} providerId={providerId} onSaved={() => { void refresh(); onSaved(); }} />}
  </div>;
}
