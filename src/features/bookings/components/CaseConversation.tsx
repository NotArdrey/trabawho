import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, MessageSquareText, RefreshCw, Send } from "lucide-react";

import { SelectField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PrivateEvidencePreview } from "@/shared/components/PrivateEvidencePreview";
import { useBookingActivity } from "@/features/bookings/hooks/useBookingActivity";
import { getCaseConversation, markCaseRead, openCaseImage, sendCaseMessage,
  type CaseAudience, type CaseMessage, type ReplacementVisit } from "@/features/bookings/services/caseWorkflow";

const date = (value: string) => new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

export function CaseConversation({ caseId, bookingId, viewerRole, closed = false, readOnly = false, highlighted = false, onChanged }: {
  caseId: string; bookingId: string; viewerRole: "admin" | "client" | "provider"; closed?: boolean; readOnly?: boolean; highlighted?: boolean; onChanged?: () => void;
}) {
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [visits, setVisits] = useState<ReplacementVisit[]>([]);
  const [unread, setUnread] = useState(0);
  const [audience, setAudience] = useState<CaseAudience>(viewerRole === "admin" ? "provider" : "admin");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [evidence, setEvidence] = useState<{ path: string; source: string; at: string } | null>(null);
  const operationId = useRef(crypto.randomUUID());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCaseConversation(caseId);
      setMessages(result.messages);
      setVisits(result.visits);
      setUnread(result.notifications.length);
      setError("");
      if (result.notifications.length) await markCaseRead(caseId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Updates could not be loaded."); }
    finally { setLoading(false); }
  }, [caseId]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  useBookingActivity(refresh, true, 30_000, "support");

  const send = async () => {
    if (pending || body.trim().length < 20) return;
    setPending(true); setError(""); setSuccess("");
    try {
      await sendCaseMessage({ caseId, bookingId, audience, body, image, operationId: operationId.current });
      setBody(""); setImage(null); setPreview(false); operationId.current = crypto.randomUUID();
      setSuccess("Update saved in the case. The recipient can see it in their case inbox.");
      await refresh(); onChanged?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Update could not be sent."); }
    finally { setPending(false); }
  };

  return <section id="case-conversation" tabIndex={-1} aria-label="Case conversation" data-highlighted={highlighted || undefined} className={cn("grid scroll-mt-24 gap-4 rounded-xl border bg-primary/5 p-4 outline outline-2 outline-offset-2 outline-transparent motion-safe:transition-[outline-color] motion-safe:duration-700 focus-visible:ring-2 focus-visible:ring-ring sm:p-5", highlighted && "outline-primary")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="flex items-center gap-2 font-semibold text-primary"><MessageSquareText className="size-4" aria-hidden="true" />Case conversation</h3><p className="mt-1 text-xs text-muted-foreground">Updates here are visible to their selected recipient. Private admin notes are separate.</p></div><div className="flex items-center gap-2">{unread > 0 && <Badge variant="brand">{unread} new</Badge>}<Button type="button" variant="outline" size="sm" className="min-h-11" disabled={loading} onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Refresh</Button></div></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading case updates…</p>}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {!loading && !messages.length && <p className="rounded-lg bg-card p-4 text-sm text-muted-foreground">No messages yet. Send an update to request information or explain the next step.</p>}
    <ol className="grid gap-2">{messages.map((message) => <li key={message.id} className="min-w-0 rounded-lg bg-card p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-1"><p className="font-semibold capitalize">{message.author_role === "admin" ? "TrabaWho support" : message.author_role}</p><p className="text-xs text-muted-foreground">{date(message.created_at)}</p></div><p className="mt-1 text-xs text-muted-foreground">To {message.audience === "both" ? "both participants" : message.audience === "admin" ? "support" : `the ${message.audience}`}</p><p className="mt-2 whitespace-pre-wrap break-words leading-6">{message.body}</p>{message.storage_path && <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11" onClick={() => setEvidence({ path: message.storage_path || "", source: message.author_role === "admin" ? "TrabaWho support" : message.author_role, at: message.created_at })}><Eye aria-hidden="true" />Preview evidence photo</Button>}</li>)}</ol>
    <PrivateEvidencePreview path={evidence?.path || null} title="Case message evidence" description={evidence ? `Attached by ${evidence.source} · ${date(evidence.at)}` : undefined} loadUrl={openCaseImage} onClose={() => setEvidence(null)} />
    {visits.length > 0 && <div className="rounded-lg bg-primary/5 p-3"><h4 className="font-semibold text-primary">Replacement visit</h4>{visits.map((visit) => <p key={visit.id} className="mt-1 text-sm capitalize">{visit.status.replaceAll("_", " ")} · Proposed {date(visit.created_at)}. See Resolution and next steps for the agreed time.</p>)}</div>}
    {!closed && !readOnly && <div className="grid gap-3 border-t pt-4"><h4 className="font-semibold text-primary">{viewerRole === "admin" ? "Send a case update" : "Reply to support"}</h4>
      {viewerRole === "admin" && <SelectField label="Send to" value={audience} disabled={pending} onValueChange={(value) => { setAudience(value as CaseAudience); setPreview(false); operationId.current = crypto.randomUUID(); }} options={[{ value: "provider", label: "Provider" }, { value: "client", label: "Client" }, { value: "both", label: "Both participants" }]} />}
      <label className="grid gap-1 text-sm font-medium">Message<textarea className="min-h-28 w-full rounded-md border border-input bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={body} disabled={pending} maxLength={4000} onChange={(event) => { setBody(event.target.value); setPreview(false); operationId.current = crypto.randomUUID(); }} placeholder="Explain what information is needed or what happens next (at least 20 characters)" /></label>
      <FilePicker accept="image/jpeg,image/png,image/webp" disabled={pending} file={image} hint="Optional JPEG, PNG, or WebP, under 5 MB" label="Evidence photo" onChange={(file) => { setImage(file); setPreview(false); operationId.current = crypto.randomUUID(); }} />
      {preview && <div className="rounded-lg border bg-card p-3 text-sm"><p className="font-semibold">Preview · To {audience === "both" ? "both participants" : audience === "admin" ? "support" : `the ${audience}`}</p><p className="mt-2 whitespace-pre-wrap break-words">{body}</p>{image && <p className="mt-2 text-xs text-muted-foreground">Photo: {image.name}</p>}</div>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={pending || body.trim().length < 20} onClick={() => setPreview(true)}>Preview update</Button><Button type="button" disabled={pending || !preview || body.trim().length < 20} onClick={() => { void send(); }}><Send aria-hidden="true" />{pending ? "Sending…" : "Send update"}</Button></div>
      {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
    </div>}
  </section>;
}
