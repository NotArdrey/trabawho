import { ArrowRight, ChartNoAxesCombined, ClipboardList, Inbox, MessageSquare, ShieldCheck, UserRoundCheck, UserRoundX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import type { AdminSection, AdminStats } from "../types";

interface Props {
  stats: AdminStats;
  totalAccounts: number;
  isLoading: boolean;
  error: string;
  onSectionChange: (section: AdminSection) => void;
}

const destinations = [
  { section: "identity", title: "Identity reviews", description: "Decide on pending manual and flagged identity checks.", icon: ShieldCheck },
  { section: "cases", title: "Support cases", description: "Review booking issues, cancellations, and refunds.", icon: Inbox },
  { section: "accounts", title: "Accounts", description: "Find people and manage roles or access.", icon: Users },
  { section: "comments", title: "Reviews", description: "Review published and unpublished feedback.", icon: MessageSquare },
  { section: "logs", title: "Audit logs", description: "Trace recorded booking, support, and identity actions.", icon: ClipboardList },
] as const;

export default function AdminOverview({ stats, totalAccounts, isLoading, error, onSectionChange }: Props) {
  const value = (count: number) => isLoading || error ? "—" : count.toLocaleString("en-PH");
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Overview</h1><p className="mt-2 max-w-2xl text-muted-foreground">Check current account access and go straight to the work that needs review.</p></div>
      <Button type="button" variant="outline" onClick={() => onSectionChange("analytics")}><ChartNoAxesCombined aria-hidden="true" />Explore analytics <ArrowRight aria-hidden="true" /></Button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    <section aria-labelledby="account-snapshot-heading" className="space-y-3">
      <div><h2 id="account-snapshot-heading" className="text-lg font-bold">Account snapshot</h2><p className="text-sm text-muted-foreground">Current access state, not limited to an analytics period.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Total accounts" value={value(totalAccounts)} detail="All account roles" tone="blue" />
        <MetricCard icon={UserRoundCheck} label="Active accounts" value={value(stats.activeAccounts)} detail="Access enabled" tone="green" />
        <MetricCard icon={UserRoundX} label="Disabled accounts" value={value(stats.disabledAccounts)} detail="Access disabled" tone="orange" />
        <MetricCard icon={ShieldCheck} label="Suspended accounts" value={value(stats.suspendedAccounts)} detail="Access temporarily restricted" tone="red" />
      </div>
    </section>
    <WorkflowPanel icon={Inbox} title="Workspace" description="Choose the queue or record you need to work on." tone="primary" contentClassName="grid sm:grid-cols-2">
      {destinations.map(({ section, title, description, icon: Icon }, index) => <button key={section} type="button" onClick={() => onSectionChange(section)} className={`flex min-h-24 w-full min-w-0 items-center gap-3 border-b px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${index % 2 ? "sm:border-l" : ""}`}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">{title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span></span>
        <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </button>)}
    </WorkflowPanel>
  </div>;
}
