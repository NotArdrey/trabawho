import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileClock,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AdminAccount,
  AdminComment,
  AdminLog,
  AdminSectionKey,
  AdminStats,
} from "@/features/admin/types";

interface AdminOverviewProps {
  stats: AdminStats;
  accounts: AdminAccount[];
  comments: AdminComment[];
  logs: AdminLog[];
  isAccountsLoading: boolean;
  accountsError: string;
  commentsError: string;
  onSectionChange: (section: AdminSectionKey) => void;
}

interface MetricCardProps {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  tone?: "brand" | "warning" | "success";
}

interface ActivityRecord {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function MetricCard({ label, value, detail, icon: Icon, tone = "brand" }: MetricCardProps) {
  const iconTone = {
    brand: "bg-primary/10 text-primary",
    warning: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  }[tone];

  return (
    <Card className="shadow-none">
      <CardContent className="flex min-h-36 items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function DataStatus({ label, state }: { label: string; state: "available" | "checking" | "issue" | "empty" }) {
  const status = {
    available: { text: "Available", icon: CheckCircle2, badge: "success" as const },
    checking: { text: "Checking", icon: Clock3, badge: "secondary" as const },
    issue: { text: "Needs attention", icon: CircleAlert, badge: "destructive" as const },
    empty: { text: "No records returned", icon: CircleAlert, badge: "outline" as const },
  }[state];
  const Icon = status.icon;

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={status.badge} className="gap-1.5">
        <Icon className="size-3.5" aria-hidden="true" />
        {status.text}
      </Badge>
    </div>
  );
}

export default function AdminOverview({
  stats,
  accounts,
  comments,
  logs,
  isAccountsLoading,
  accountsError,
  commentsError,
  onSectionChange,
}: AdminOverviewProps) {
  const providerCount = accounts.filter((account) => ["worker", "seller"].includes(account.role)).length;
  const reviewCount = comments.filter((comment) => ["flagged", "review"].includes(comment.status)).length;
  const restrictedCount = stats.disabledAccounts + stats.suspendedAccounts;

  const recentActivity: ActivityRecord[] = [
    ...accounts.flatMap((account) => {
      const timestamp = account.updatedAt ?? account.createdAt;
      return timestamp
        ? [{
            id: `account-${account.id}`,
            title: `${account.name} account updated`,
            detail: `${account.role} · ${account.displayStatus}`,
            timestamp,
          }]
        : [];
    }),
    ...comments.flatMap((comment) => comment.createdAt
      ? [{
          id: `comment-${comment.id}`,
          title: `New review for ${comment.worker}`,
          detail: `${comment.rating} out of 5 · ${comment.status}`,
          timestamp: comment.createdAt,
        }]
      : []),
  ]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-1.5 bg-gradient-to-r from-[var(--brand-blue)] via-[var(--brand-blue)] to-[var(--brand-orange)]" />
        <div className="flex flex-col gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Admin operations</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">TrabaWho Admin Dashboard</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Monitor platform activity, handle review queues, and move into focused management workspaces.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="size-4 text-primary" aria-hidden="true" />
            <span>Operational overview</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-metrics-heading">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="overview-metrics-heading" className="text-lg font-semibold">Overview</h2>
          <p className="text-xs text-muted-foreground">Verified from currently connected records</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total users" value={accounts.length} detail="All loaded TrabaWho accounts" icon={Users} />
          <MetricCard label="Service providers" value={providerCount} detail="Worker and seller accounts" icon={BriefcaseBusiness} />
          <MetricCard label="Active accounts" value={stats.activeAccounts} detail="Accounts with active access" icon={UserRoundCheck} tone="success" />
          <MetricCard label="Review queue" value={reviewCount} detail="Flagged or unpublished comments" icon={ShieldCheck} tone="warning" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Pending reviews</CardTitle>
              <CardDescription className="mt-1.5">Work that may need an administrator’s decision.</CardDescription>
            </div>
            <Badge variant={reviewCount + restrictedCount > 0 ? "warning" : "success"}>
              {reviewCount + restrictedCount} actionable
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              type="button"
              className="flex min-h-16 w-full items-center gap-4 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSectionChange("users")}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Account access reviews</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">Disabled and suspended accounts</span>
              </span>
              <Badge variant={restrictedCount > 0 ? "warning" : "secondary"}>{restrictedCount}</Badge>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex min-h-16 w-full items-center gap-4 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSectionChange("moderation")}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Content moderation</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">Flagged or unpublished review comments</span>
              </span>
              <Badge variant={reviewCount > 0 ? "warning" : "secondary"}>{reviewCount}</Badge>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex min-h-16 w-full items-center gap-4 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSectionChange("employers")}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Employer verification</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">Live verification source is not connected</span>
              </span>
              <Badge variant="outline">Unavailable</Badge>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>System health</CardTitle>
            <CardDescription>Status of the data sources used on this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataStatus label="Account records" state={isAccountsLoading ? "checking" : accountsError ? "issue" : "available"} />
            <DataStatus label="Moderation records" state={commentsError ? "issue" : "available"} />
            <DataStatus label="Audit activity" state={logs.length > 0 ? "available" : "empty"} />
            {(accountsError || commentsError) ? (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm leading-5 text-destructive" role="status">
                One or more admin data sources could not be loaded. Open the affected section for details.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription className="mt-1.5">Latest updates from connected records.</CardDescription>
            </div>
            <Clock3 className="size-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    <time className="text-right text-xs text-muted-foreground" dateTime={item.timestamp}>
                      {formatTimestamp(item.timestamp)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                No timestamped account or moderation activity is available yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Open a focused admin workspace.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-auto min-h-16 justify-start px-4 py-3" onClick={() => onSectionChange("users")}>
              <Users aria-hidden="true" />
              Manage users
            </Button>
            <Button type="button" variant="outline" className="h-auto min-h-16 justify-start px-4 py-3" onClick={() => onSectionChange("moderation")}>
              <ShieldCheck aria-hidden="true" />
              Review moderation
            </Button>
            <Button type="button" variant="outline" className="h-auto min-h-16 justify-start px-4 py-3" onClick={() => onSectionChange("employers")}>
              <Building2 aria-hidden="true" />
              Review employers
            </Button>
            <Button type="button" variant="outline" className="h-auto min-h-16 justify-start px-4 py-3" onClick={() => onSectionChange("audit-logs")}>
              <FileClock aria-hidden="true" />
              View audit logs
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Audit activity</CardTitle>
            <CardDescription className="mt-1.5">Recent sensitive administrator actions.</CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={() => onSectionChange("audit-logs")}>
            View all
            <ArrowRight aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ul className="grid gap-3 lg:grid-cols-3">
              {logs.slice(0, 3).map((log) => (
                <li key={log.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{log.action}</p>
                    <Badge variant={log.severity === "high" ? "destructive" : log.severity === "medium" ? "warning" : "secondary"}>
                      {log.severity}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{log.actor} · {log.target}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{log.timestamp}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
              No audit records are available from the current admin data source.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
