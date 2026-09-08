import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarCheck,
  CircleAlert,
  Clock3,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Star,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardNavigation from "@/shared/components/DashboardNavigation";
import { useProviderDashboard } from "@/features/work/hooks/useProviderDashboard";
import type { ProviderActionItem } from "@/features/work/types/provider-dashboard";

type SellerProfile = Record<string, unknown> & {
  userId?: string;
  user_id?: string;
  role?: string;
};

interface WorkerDashboardProps {
  currentView?: string;
  searchQuery?: string;
  onSearchChange?: (event: unknown) => void;
  onLogout?: () => void;
  onOpenSellerSetup?: () => void;
  onOpenMyBookings?: () => void;
  onOpenChatPage?: (bookingId?: string | null) => void;
  sellerProfile?: SellerProfile | null;
  onOpenMyWork?: () => void;
  onOpenProfile?: () => void;
  onOpenAccountSettings?: () => void;
  onOpenSettings?: () => void;
  onOpenDashboard?: () => void;
  onOpenBrowseServices?: () => void;
  onOpenAdminDashboard?: () => void;
  onBackToClient?: () => void;
}

const metricIcons = {
  inquiries: ListChecks,
  today: CalendarCheck,
  messages: MessageSquareText,
  earnings: Banknote,
} as const;

const metricTones = {
  inquiries: "orange",
  today: "blue",
  messages: "sky",
  earnings: "green",
} as const;

const metricActionLabels = {
  inquiries: "Open provider inquiries",
  today: "Open today's incoming bookings",
  messages: "Open client messages",
  earnings: "Open earnings in My Work",
} as const;

function DashboardSkeleton() {
  return <div className="space-y-5" aria-label="Loading provider dashboard"><Skeleton className="h-28 w-full" /><div className="grid gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}</div><div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>;
}

function WorkerDashboard({
  currentView = "worker-dashboard",
  searchQuery = "",
  onSearchChange,
  onLogout,
  onOpenSellerSetup,
  onOpenMyBookings,
  onOpenChatPage,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenAdminDashboard,
}: WorkerDashboardProps) {
  const userId = String(sellerProfile?.userId || sellerProfile?.user_id || "");
  const { snapshot, isLoading, error, refresh } = useProviderDashboard(userId, sellerProfile);

  const openAction = (action: ProviderActionItem) => {
    if (action.destination === "messages") onOpenChatPage?.(action.bookingId || null);
    else if (action.destination === "bookings") onOpenMyBookings?.();
    else onOpenMyWork?.();
  };

  const openMetric = (metricId: keyof typeof metricIcons) => {
    if (metricId === "messages") onOpenChatPage?.();
    else if (metricId === "today") onOpenMyBookings?.();
    else onOpenMyWork?.();
  };

  return (
    <div className="gl-page min-h-screen" data-testid="provider-home-dashboard">
      <DashboardNavigation
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup}
        onOpenMyBookings={onOpenMyBookings}
        onOpenChatPage={onOpenChatPage}
        sellerProfile={sellerProfile}
        onOpenMyWork={onOpenMyWork}
        onOpenProfile={onOpenProfile}
        onOpenAccountSettings={onOpenAccountSettings}
        onOpenSettings={onOpenSettings}
        onOpenDashboard={onOpenDashboard}
        onOpenBrowseServices={onOpenBrowseServices}
        isAdminView={false}
        onToggleAdminView={onOpenAdminDashboard}
      />

      <main className="gl-shell gl-page-pad mx-auto max-w-7xl space-y-5" id="worker-home">
        {isLoading && !snapshot ? <DashboardSkeleton /> : (
          <>
            <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center" aria-labelledby="provider-dashboard-title">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Provider overview</Badge>
                  {snapshot?.serviceHealth.verificationStatus ? <Badge variant={snapshot.serviceHealth.verificationStatus === "approved" ? "success" : "warning"}>{snapshot.serviceHealth.verificationStatus}</Badge> : null}
                </div>
                <h1 id="provider-dashboard-title" className="text-3xl font-bold tracking-tight md:text-4xl">Good to see you, {snapshot?.providerName || "Provider"}.</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">Review work that needs attention, today’s schedule, and the health of your services.</p>
              </div>
              <Button type="button" className="hidden md:inline-flex" onClick={snapshot?.hasProviderSetup ? onOpenMyWork : onOpenSellerSetup}>
                <BriefcaseBusiness aria-hidden="true" />{snapshot?.hasProviderSetup ? "Manage My Work" : "Complete provider setup"}
              </Button>
            </section>

            {error ? <div className="flex flex-col justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center" role="alert"><div className="flex gap-3"><CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" /><div><p className="font-semibold">Dashboard unavailable</p><p className="text-sm text-muted-foreground">{error}</p></div></div><Button type="button" variant="outline" onClick={() => void refresh()}><RefreshCw aria-hidden="true" />Try again</Button></div> : null}

            {snapshot ? (
              <>
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Provider summary">
                  {snapshot.metrics.map((metric) => <MetricCard key={metric.id} actionLabel={metricActionLabels[metric.id]} detail={metric.detail} icon={metricIcons[metric.id]} label={metric.label} onClick={() => openMetric(metric.id)} tone={metricTones[metric.id]} value={metric.value} />)}
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]">
                  <Card className="border-border shadow-none">
                    <CardHeader className="flex-row items-start justify-between space-y-0 p-5">
                      <div><CardTitle>Needs your attention</CardTitle><CardDescription className="mt-1">The most important items across your provider workspace.</CardDescription></div>
                      <Badge variant={snapshot.actions.length ? "warning" : "success"}>{snapshot.actions.length || "Clear"}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-1 px-3 pb-3">
                      {snapshot.actions.length ? snapshot.actions.map((action, index) => (
                        <div key={action.id}>
                          {index > 0 ? <Separator /> : null}
                          <button type="button" className="flex min-h-20 w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openAction(action)}>
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200"><CircleAlert className="size-4" aria-hidden="true" /></span>
                            <span className="min-w-0 flex-1"><strong className="block text-sm">{action.title}</strong><span className="mt-1 block text-sm leading-5 text-muted-foreground sm:truncate">{action.detail}</span><span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">{action.schedule ? <span>{action.schedule}</span> : null}{action.amount ? <span>{action.amount}</span> : null}</span></span>
                            {action.status ? <Badge variant="outline" className="hidden sm:inline-flex">{action.status}</Badge> : null}<ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                          </button>
                        </div>
                      )) : <div className="grid min-h-48 place-items-center px-5 text-center"><div><span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"><ListChecks className="size-5" aria-hidden="true" /></span><p className="mt-3 font-semibold">You’re all caught up</p><p className="mt-1 text-sm text-muted-foreground">New requests and account actions will appear here.</p></div></div>}
                    </CardContent>
                  </Card>

                  <Card className="border-border shadow-none">
                    <CardHeader className="p-5"><CardTitle>Today’s schedule</CardTitle><CardDescription>{snapshot.todaySchedule.length ? `${snapshot.todaySchedule.length} job${snapshot.todaySchedule.length === 1 ? "" : "s"} scheduled` : "No jobs scheduled today"}</CardDescription></CardHeader>
                    <CardContent className="space-y-3 px-5 pb-5">
                      {snapshot.todaySchedule.length ? snapshot.todaySchedule.slice(0, 4).map((item) => <button key={item.id} type="button" className="flex w-full gap-3 rounded-lg bg-secondary/60 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onOpenMyBookings}><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span><strong className="block text-sm">{item.service}</strong><span className="block text-xs text-muted-foreground">{item.client} · {item.schedule}</span></span></button>) : <div className="rounded-lg bg-secondary/60 p-4"><p className="text-sm font-semibold">Your day is clear</p><p className="mt-1 text-xs text-muted-foreground">Manage availability from My Work.</p></div>}
                      {snapshot.nextAppointment && !snapshot.todaySchedule.some((item) => item.id === snapshot.nextAppointment?.id) ? <><Separator /><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next appointment</p><p className="mt-2 text-sm font-semibold">{snapshot.nextAppointment.service}</p><p className="text-xs text-muted-foreground">{snapshot.nextAppointment.client} · {snapshot.nextAppointment.schedule}</p></div></> : null}
                    </CardContent>
                  </Card>
                </section>

                <Card className="border-border shadow-none">
                  <CardHeader className="flex flex-col items-stretch gap-4 space-y-0 p-5 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Service health</CardTitle><CardDescription className="mt-1">Live status from your published services and availability.</CardDescription></div><Button type="button" className="w-full sm:w-auto" variant="outline" onClick={onOpenMyWork}><Store aria-hidden="true" />Manage services</Button></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 px-5 pb-5 lg:grid-cols-4">
                    <div><p className="text-xs text-muted-foreground">Active listings</p><p className="mt-1 text-xl font-bold">{snapshot.serviceHealth.activeListings} <span className="text-sm font-medium text-muted-foreground">of {snapshot.serviceHealth.totalListings}</span></p></div>
                    <div><p className="text-xs text-muted-foreground">Available slots</p><p className="mt-1 text-xl font-bold">{snapshot.serviceHealth.availableSlots}</p></div>
                    <div><p className="text-xs text-muted-foreground">Provider rating</p><p className="mt-1 flex items-center gap-1 text-xl font-bold"><Star className="size-4 text-orange-500" aria-hidden="true" />{snapshot.serviceHealth.rating ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Published reviews</p><p className="mt-1 text-xl font-bold">{snapshot.serviceHealth.reviewCount}</p></div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

export default WorkerDashboard;
