import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  MessageCircle,
  ReceiptText,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard, type MetricCardTone } from "@/components/ui/metric-card";
import { WorkflowEmptyState, WorkflowPanel } from "@/components/ui/workflow-panel";
import {
  buildDashboardModel,
  emptyDashboardData,
  type DashboardMetricId,
  type DashboardSnapshot,
} from "@/features/dashboard/domain/dashboardModel";
import { fetchClientDashboardSnapshot } from "@/features/bookings/services/bookingService";
import DashboardNavigation, { type DashboardProfile } from "@/shared/components/DashboardNavigation";

type NavigationHandler = () => void;

interface ClientDashboardProfile extends DashboardProfile {
  full_name?: string;
}

export interface DashboardProps {
  appTheme?: string;
  currentView?: string;
  onBecomeSeller?: NavigationHandler;
  onLogout?: () => void | Promise<void>;
  onOpenAccountSettings?: NavigationHandler;
  onOpenAdminDashboard?: NavigationHandler;
  onOpenBrowseServices?: NavigationHandler;
  onOpenChatPage?: NavigationHandler;
  onOpenDashboard?: NavigationHandler;
  onOpenMyBookings?: NavigationHandler;
  onOpenMyWork?: NavigationHandler;
  onOpenProfile?: NavigationHandler;
  onOpenSellerSetup?: NavigationHandler;
  onOpenSettings?: NavigationHandler;
  onSearchChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onThemeChange?: (mode: string) => void;
  searchQuery?: string;
  sellerProfile?: ClientDashboardProfile | null;
  themeMode?: string;
}

const metricVisuals: Record<DashboardMetricId, { icon: typeof Clock3; tone: MetricCardTone }> = {
  active: { icon: Clock3, tone: "blue" },
  upcoming: { icon: CalendarCheck, tone: "green" },
  messages: { icon: MessageCircle, tone: "sky" },
  actions: { icon: ReceiptText, tone: "orange" },
};

export default function Dashboard({
  currentView = "client-dashboard",
  searchQuery = "",
  onSearchChange,
  onLogout,
  onBecomeSeller,
  onOpenMyBookings,
  onOpenChatPage,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenSellerSetup,
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenAdminDashboard,
}: DashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardSnapshot>(emptyDashboardData);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const displayName = sellerProfile?.firstName || sellerProfile?.fullName || sellerProfile?.full_name || "there";
  const dashboardModel = useMemo(() => buildDashboardModel(dashboardData, isDashboardLoading), [dashboardData, isDashboardLoading]);
  const metricHandlers: Record<DashboardMetricId, NavigationHandler> = {
    active: () => onOpenMyBookings?.(),
    upcoming: () => onOpenMyBookings?.(),
    messages: () => onOpenChatPage?.(),
    actions: () => onOpenMyBookings?.(),
  };

  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      try {
        setIsDashboardLoading(true);
        setDashboardError("");
        const snapshot = await fetchClientDashboardSnapshot() as DashboardSnapshot | null;
        if (isMounted) setDashboardData(snapshot || emptyDashboardData);
      } catch (error) {
        if (isMounted) {
          setDashboardError(error instanceof Error ? error.message : "Unable to load dashboard activity.");
          setDashboardData(emptyDashboardData);
        }
      } finally {
        if (isMounted) setIsDashboardLoading(false);
      }
    };
    void loadDashboardData();
    return () => { isMounted = false; };
  }, [sellerProfile?.userId]);

  return (
    <div className="gl-page" data-testid="client-home-dashboard">
      <DashboardNavigation
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup || onBecomeSeller}
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

      <main className="gl-shell gl-page-pad dashboard-launchpad">
        <section className="dashboard-overview" aria-labelledby="dashboard-title">
          <div className="dashboard-overview-head dashboard-client-header">
            <div>
              <h1 id="dashboard-title" className="gl-title !mt-0">Good to see you, {displayName}.</h1>
              <p className="gl-subtitle">Your booking activity, provider messages, and service requests are organized here.</p>
              {dashboardError ? <p className="mt-2 text-sm font-medium text-destructive" role="status">{dashboardError}</p> : null}
            </div>
            <div className="dashboard-hero-actions">
              <Button type="button" onClick={onOpenBrowseServices}><Search aria-hidden="true" />Browse services</Button>
            </div>
          </div>

          <div className="dashboard-metric-grid">
            {dashboardModel.metrics.map((item) => (
              <MetricCard
                key={item.id}
                {...item}
                icon={metricVisuals[item.id].icon}
                tone={metricVisuals[item.id].tone}
                actionLabel={item.id === "messages" ? "Open messages" : `Open bookings for ${item.label.toLowerCase()}`}
                onClick={metricHandlers[item.id]}
              />
            ))}
          </div>
        </section>

        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]" aria-label="Dashboard workspace">
          <WorkflowPanel
            icon={CalendarCheck}
            tone="primary"
            title="Your next services"
            description="Upcoming appointments and requests that are still active."
            status={dashboardModel.upcomingBookings.length ? <Badge variant="default">{dashboardModel.upcomingBookings.length} upcoming</Badge> : undefined}
            action={<Button type="button" variant="outline" onClick={onOpenMyBookings}>View all bookings<ArrowRight aria-hidden="true" /></Button>}
          >
            {dashboardModel.upcomingBookings.length ? (
              <div className="divide-y">
                {dashboardModel.upcomingBookings.map((booking) => (
                  <article className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5" key={`${booking.service}-${booking.schedule}`}>
                    <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"><CalendarCheck className="size-5" aria-hidden="true" /></span>
                    <div className="min-w-0"><h3 className="font-bold text-foreground">{booking.service}</h3><p className="mt-1 text-sm text-muted-foreground">{booking.provider} · <strong className="font-semibold text-foreground">{booking.schedule}</strong></p></div>
                    <Badge variant="success" className="w-fit">{booking.status}</Badge>
                  </article>
                ))}
              </div>
            ) : (
              <WorkflowEmptyState
                icon={CalendarPlus}
                tone="primary"
                title={isDashboardLoading ? "Checking your schedule…" : "No upcoming services"}
                description={isDashboardLoading ? "We’re loading your latest bookings." : "When you book a provider, the date, time, and current status will appear here."}
                action={!isDashboardLoading ? <Button type="button" onClick={onOpenBrowseServices}><Search aria-hidden="true" />Find a service</Button> : undefined}
              />
            )}
          </WorkflowPanel>

          <WorkflowPanel
            icon={BellRing}
            tone="neutral"
            title="Recent updates"
            description="Latest booking and message activity."
            status={dashboardModel.recentUpdates.length ? <Badge variant="secondary">Latest {dashboardModel.recentUpdates.length}</Badge> : undefined}
          >
            {dashboardModel.recentUpdates.length ? (
              <ol className="divide-y">
                {dashboardModel.recentUpdates.map((update) => (
                  <li className="flex gap-3 px-4 py-4 sm:px-5" key={update.id}>
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="size-4" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><h3 className="text-sm font-bold text-foreground">{update.title}</h3><time className="text-xs font-semibold text-muted-foreground">{update.time}</time></div><p className="mt-1 text-sm leading-5 text-muted-foreground">{update.detail}</p></div>
                  </li>
                ))}
              </ol>
            ) : (
              <WorkflowEmptyState icon={BellRing} title={isDashboardLoading ? "Loading recent activity…" : "You’re all caught up"} description={isDashboardLoading ? "We’re checking bookings and messages." : "New booking and message updates will appear here."} />
            )}
          </WorkflowPanel>
        </section>
      </main>
    </div>
  );
}
