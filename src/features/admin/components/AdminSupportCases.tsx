import { useEffect, useState } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase";

interface SupportCase {
  id: string;
  booking_id: string;
  reporter_id: string;
  case_type: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function AdminSupportCases() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await supabase.from("booking_support_cases")
        .select("id, booking_id, reporter_id, case_type, reason, status, created_at")
        .order("created_at", { ascending: false }).limit(50);
      if (!active) return;
      setCases(result.data || []);
      setError(result.error?.message || "");
      setLoading(false);
    })();
    return () => { active = false; };
  }, [refresh]);

  return <section className="space-y-4" aria-labelledby="support-cases-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 id="support-cases-title" className="text-2xl font-bold">Booking support cases</h1><p className="mt-1 text-sm text-muted-foreground">Read-only triage for test bookings. Refunds and payouts are not executed here.</p></div><Button variant="outline" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RefreshCw aria-hidden="true" />Refresh</Button></div>
    {loading && <p role="status" className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading support cases…</p>}
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{error}</div>}
    {!loading && !error && cases.length === 0 && <div className="rounded-xl border bg-card p-8 text-center"><Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><p className="mt-2 font-semibold">No support cases yet</p><p className="text-sm text-muted-foreground">Reports submitted from booking cards will appear here.</p></div>}
    {!loading && !error && cases.length > 0 && <div className="grid gap-3">{cases.map((item) => <article key={item.id} className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold capitalize">{item.case_type.replaceAll("_", " ")}</h2><Badge variant={item.status === "open" ? "warning" : "secondary"}>{item.status.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-sm">{item.reason}</p><dl className="mt-3 grid gap-2 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-3"><div><dt>Booking</dt><dd className="break-all font-medium text-foreground">{item.booking_id}</dd></div><div><dt>Reporter</dt><dd className="break-all font-medium text-foreground">{item.reporter_id}</dd></div><div><dt>Reported</dt><dd className="font-medium text-foreground">{new Date(item.created_at).toLocaleString("en-PH")}</dd></div></dl></article>)}</div>}
  </section>;
}
