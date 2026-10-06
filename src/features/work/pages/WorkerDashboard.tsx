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
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import DashboardNavigation from "@/shared/components/DashboardNavigation";
import { ProviderServicesPanel } from "@/features/work/components/ProviderServicesPanel";
import { useProviderDashboard } from "@/features/work/hooks/useProviderDashboard";
import type { ProviderActionItem, ProviderScheduleItem } from "@/features/work/types/provider-dashboard";
import { providerActionPath, providerBookingPath } from "@/features/work/domain/providerQuickNav";
import { paths } from "@/app/router/routes";

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
  onOpenChatPage?: (bookingId?: string | null, scope?: "incoming") => void;
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
  inquiries: "Open incoming bookings",
  today: "Open today's incoming bookings",
  messages: "Open client messages",
} as const;

function DashboardSkeleton() {
  return <div className="space-y-5" aria-label="Loading provider dashboard"><Skeleton className="h-28 w-full" /><div className="grid gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}</div><div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>;
}

function AttentionPanel({ actions, onOpen }: { actions: readonly ProviderActionItem[]; onOpen: (action: ProviderActionItem) => void }) {
  return (
    <WorkflowPanel icon={CircleAlert} title="Needs your attention" description="Priority updates across your provider workspace." tone="highlight" status={<Badge variant={actions.length ? "brand" : "success"}>{actions.length || "Clear"}</Badge>}>
      {actions.length ? <div className="divide-y px-2 py-1">{actions.map((action) => (
        <button key={action.id} type="button" className="group flex min-h-[76px] w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3" onClick={() => onOpen(action)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-highlight-soft text-brand-highlight-foreground"><CircleAlert className="size-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm text-foreground">{action.title}</strong><span className="mt-1 block text-sm leading-5 text-muted-foreground sm:truncate">{action.detail}</span><span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">{action.schedule ? <span>{action.schedule}</span> : null}{action.amount ? <span>{action.amount}</span> : null}</span></span>
          {action.status ? <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{action.status}</Badge> : null}
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </button>
      ))}</div> : <div className="flex items-start gap-3 px-4 py-5 sm:px-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><ListChecks className="size-5" aria-hidden="true" /></span><div><h3 className="font-semibold">You’re all caught up</h3><p className="mt-1 text-sm text-muted-foreground">Requests that need a response will appear here.</p></div></div>}
    </WorkflowPanel>
  );
}

function ProviderVisitRow({ item, next = false, onOpen }: { item: ProviderScheduleItem; next?: boolean; onOpen: (bookingId: string) => void }) {
  return <button type="button" className="group flex min-h-20 w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5" onClick={() => onOpen(item.bookingId)}>
    <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
    <span className="min-w-0 flex-1">
      {next && <span className="mb-1 block text-xs font-semibold text-primary">Next appointment</span>}
      <strong className="block text-sm text-foreground">{item.service}</strong>
      <span className="mt-1 block text-sm text-muted-foreground">{item.client} · <span className="font-semibold text-foreground">{item.schedule}</span></span>
      {item.supportCaseOpen && <span className="mt-1 block text-xs text-muted-foreground">Agreed new time · Support case open</span>}
      <Badge variant={item.status === "Replacement visit confirmed" ? "default" : item.status === "Payment Confirmed" ? "success" : "outline"} className="mt-2">{item.status}</Badge>
    </span>
    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
  </button>;
}

function SchedulePanel({ items, nextAppointment, onOpenBooking, onOpenAll, onManageAvailability }: { items: readonly ProviderScheduleItem[]; nextAppointment: ProviderScheduleItem | null; onOpenBooking: (bookingId: string) => void; onOpenAll: () => void; onManageAvailability?: () => void }) {
  return (
    <WorkflowPanel icon={CalendarCheck} title="Today's schedule" description={items.length ? `${items.length} visit${items.length === 1 ? "" : "s"} today · Philippine time` : "No visits today · Philippine time"} tone="primary" action={<Button type="button" variant="outline" onClick={onOpenAll}>View bookings<ArrowRight aria-hidden="true" /></Button>}>
      {items.length ? <div className="divide-y">{items.slice(0, 4).map((item) => <ProviderVisitRow key={item.id} item={item} onOpen={onOpenBooking} />)}{items.length > 4 && <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">Showing 4 of {items.length} visits today. View bookings for the full schedule.</p>}</div>
        : <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-muted-foreground sm:px-5"><p>{nextAppointment ? "Your next appointment is below." : "No appointments are scheduled for today."}</p>{!nextAppointment && onManageAvailability && <Button type="button" variant="outline" size="sm" onClick={onManageAvailability}>Manage availability</Button>}</div>}
      {nextAppointment && !items.some((item) => item.id === nextAppointment.id) && <div className="border-t bg-muted/20"><ProviderVisitRow item={nextAppointment} next onOpen={onOpenBooking} /></div>}
    </WorkflowPanel>
  );
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
  const navigate = useNavigate();
  const { snapshot, isLoading, error, refresh } = useProviderDashboard(userId, sellerProfile);

  const openAction = (action: ProviderActionItem) => {
    const path = providerActionPath(action);
    if (path) void navigate(path);
  };

  const openMetric = (metricId: keyof typeof metricIcons) => {
    if (metricId === "messages") onOpenChatPage?.(null, "incoming");
    else if (metricId === "inquiries") void navigate(`${paths.workerBookings}?scope=incoming&filter=inquiries`);
    else if (metricId === "today") onOpenMyBookings?.();
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
                <h1 id="provider-dashboard-title" className="text-3xl font-bold tracking-tight md:text-4xl">Good to see you, {snapshot?.providerName || "Provider"}.</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">Review requests, upcoming visits, and how your services are performing.</p>
              </div>
              <Button type="button" className="hidden md:inline-flex" onClick={snapshot?.hasProviderSetup ? onOpenMyWork : onOpenSellerSetup}>
                <BriefcaseBusiness aria-hidden="true" />{snapshot?.hasProviderSetup ? "Manage My Work" : "Complete provider setup"}
              </Button>
            </section>

            {error ? <div className="flex flex-col justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center" role="alert"><div className="flex gap-3"><CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" /><div><p className="font-semibold">Dashboard unavailable</p><p className="text-sm text-muted-foreground">{error}</p></div></div><Button type="button" variant="outline" onClick={() => void refresh()}><RefreshCw aria-hidden="true" />Try again</Button></div> : null}

            {snapshot ? (
              <>
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Provider summary">
                  {snapshot.metrics.map((metric) => <MetricCard key={metric.id} actionLabel={metric.id === "earnings" ? undefined : metricActionLabels[metric.id]} detail={metric.detail} icon={metricIcons[metric.id]} label={metric.label} onClick={metric.id === "earnings" ? undefined : () => openMetric(metric.id)} tone={metricTones[metric.id]} value={metric.value} />)}
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]">
                  <AttentionPanel actions={snapshot.actions} onOpen={openAction} />
                  <SchedulePanel items={snapshot.todaySchedule} nextAppointment={snapshot.nextAppointment} onOpenBooking={(bookingId) => { void navigate(providerBookingPath(bookingId)); }} onOpenAll={() => { void navigate(providerBookingPath()); }} onManageAvailability={onOpenMyWork} />
                </section>

                <ProviderServicesPanel health={snapshot.serviceHealth} listings={snapshot.serviceListings} onManageServices={onOpenMyWork} />
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

export default WorkerDashboard;
