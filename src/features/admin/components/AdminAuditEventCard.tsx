import { BadgeCheck, CalendarDays, LifeBuoy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AuditEntry, AuditSource } from "../types/admin-activity";

const sourceDisplay = {
  bookings: { label: "Booking", Icon: CalendarDays, iconClass: "bg-primary/10 text-primary", badgeClass: "bg-primary/10 text-primary" },
  support: { label: "Support follow-up", Icon: LifeBuoy, iconClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200", badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  identity: { label: "Identity review", Icon: BadgeCheck, iconClass: "bg-brand-highlight-soft text-brand-highlight-foreground", badgeClass: "bg-brand-highlight-soft text-brand-highlight-foreground" },
} satisfies Record<AuditSource, { label: string; Icon: typeof CalendarDays; iconClass: string; badgeClass: string }>;

function outcomeVariant(outcome: string): "secondary" | "success" | "warning" | "destructive" {
  const finalState = outcome.split(/→|->/).at(-1)?.trim().toLowerCase() || "";
  if (/\b(failed|rejected|declined|denied)\b/.test(finalState)) return "destructive";
  if (/\b(cancelled|canceled|pending|expired)\b/.test(finalState)) return "warning";
  if (/\b(approved|confirmed|completed|paid|succeeded|resolved|refunded)\b/.test(finalState)) return "success";
  return "secondary";
}

export function AdminAuditEventCard({ entry }: { entry: AuditEntry }) {
  const source = sourceDisplay[entry.source];
  const Icon = source.Icon;
  return <Card><CardContent className="grid min-w-0 gap-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${source.iconClass}`}><Icon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0"><Badge variant="secondary" className={source.badgeClass}>{source.label}</Badge><h2 className="mt-2 break-words font-semibold capitalize text-foreground">{entry.action}</h2><p className="mt-1 break-words text-sm text-muted-foreground">By {entry.actor}</p></div>
      </div>
      <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} PHT</time>
    </div>
    <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      <div className="min-w-0 rounded-lg bg-primary/5 px-4 py-3 dark:bg-primary/10"><dt className="text-xs font-semibold uppercase tracking-wide text-primary">Target reference</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{entry.target}</dd></div>
      <div className="min-w-0 rounded-lg bg-muted/60 px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recorded outcome</dt><dd className="mt-2"><Badge variant={outcomeVariant(entry.outcome)} className="max-w-full whitespace-normal break-words text-left">{entry.outcome}</Badge></dd></div>
    </dl>
    {entry.reason && <div className="border-t border-border pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason or note</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{entry.reason}</p></div>}
  </CardContent></Card>;
}
