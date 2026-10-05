import AdminAnalytics from "./AdminAnalytics";
import { ArrowRight, ClipboardList, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminSection, AdminStats } from "../types";

interface Props { stats: AdminStats; totalAccounts: number; isLoading: boolean; error: string; onSectionChange: (section: AdminSection) => void }

export default function AdminOverview({ stats, totalAccounts, isLoading, error, onSectionChange }: Props) {
  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Overview</h1><p className="mt-2 text-muted-foreground">Manage account access and review platform activity.</p></div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    <section aria-label="Account summary" className="grid gap-4 sm:grid-cols-3">
      {[["Total accounts", totalAccounts], ["Disabled accounts", stats.disabledAccounts], ["Suspended accounts", stats.suspendedAccounts]].map(([label, value]) =>
        <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-foreground">{isLoading || error ? "—" : value}</p></CardContent></Card>)}
    </section>
    <AdminAnalytics embedded />
    <section aria-labelledby="admin-workspace-heading"><h2 id="admin-workspace-heading" className="mb-3 text-lg font-semibold">Workspace</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><Users className="mb-2 size-6 text-primary" aria-hidden="true" /><CardTitle>Accounts</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Find people and manage roles or access restrictions.</p><Button onClick={() => onSectionChange("accounts")}>Review accounts <ArrowRight aria-hidden="true" /></Button></CardContent></Card>
        <Card><CardHeader><MessageSquare className="mb-2 size-6 text-primary" aria-hidden="true" /><CardTitle>Reviews</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Review recent feedback. Flag reports are not available yet.</p><Button onClick={() => onSectionChange("comments")}>View reviews <ArrowRight aria-hidden="true" /></Button></CardContent></Card>
        <Card><CardHeader><ClipboardList className="mb-2 size-6 text-primary" aria-hidden="true" /><CardTitle>Audit logs</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Inspect recorded booking, support, and identity activity.</p><Button onClick={() => onSectionChange("logs")}>View logs <ArrowRight aria-hidden="true" /></Button></CardContent></Card>
      </div>
    </section>
  </div>;
}
