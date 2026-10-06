import { useBookingActivity } from "@/features/bookings/activity";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarPlus,
  CircleAlert,
  Clock3,
  CreditCard,
  MessageCircle,
  MessageSquareText,
  ReceiptText,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard, type MetricCardTone } from "@/components/ui/metric-card";
import { WorkflowEmptyState, WorkflowPanel } from "@/components/ui/workflow-panel";
import { ClientNextSteps } from "@/features/dashboard/components/ClientNextSteps";
import { buildClientBookingActions, getClientCaseProgress, type DashboardCase } from "@/features/dashboard/domain/clientNextSteps";
import {
  buildDashboardModel,
  emptyDashboardData,
  type DashboardMetricId,
  type DashboardSnapshot,
  type RecentUpdate,
} from "@/features/dashboard/domain/dashboardModel";
import { fetchClientOverviewSnapshot } from "@/features/dashboard/services/clientDashboardService";
import { fetchClientOverviewCases } from "@/features/dashboard/services/clientDashboardCases";
import DashboardNavigation, { type DashboardProfile } from "@/shared/components/DashboardNavigation";
import { cn } from "@/lib/utils";

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
  onOpenChatPage?: (bookingId?: string | number | null, scope?: "purchases") => void;
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

const updateVisuals: Record<RecentUpdate["category"], { icon: typeof BellRing; className: string }> = {
  message: { icon: MessageSquareText, className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200" },
  visit: { icon: CalendarCheck, className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200" },
  payment: { icon: CreditCard, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" },
  refund: { icon: ReceiptText, className: "bg-brand-highlight-soft text-brand-highlight-foreground" },
  support: { icon: CircleAlert, className: "bg-brand-highlight-soft text-brand-highlight-foreground" },
  cancelled: { icon: CircleAlert, className: "bg-secondary text-secondary-foreground" },
  general: { icon: BellRing, className: "bg-primary/10 text-primary" },
};

function RecentUpdateContent({ update, linked }: { update: RecentUpdate; linked: boolean }) {
  const { icon: Icon, className } = updateVisuals[update.category];
  return <><span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", className)}><Icon className="size-[18px]" aria-hidden="true" /></span>
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><strong className="text-sm font-semibold leading-5 text-foreground">{update.title}</strong><span className="text-xs font-medium text-muted-foreground">{update.time}</span></span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{update.detail}</span></span>
    {linked && <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}</>;
}

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
  const [cases, setCases] = useState<DashboardCase[]>([]);
  const [casesError, setCasesError] = useState(false);
  const [casesLoading, setCasesLoading] = useState(true);
  const displayName = sellerProfile?.firstName || sellerProfile?.fullName || sellerProfile?.full_name || "there";
  const dashboardModel = useMemo(() => buildDashboardModel(dashboardData, isDashboardLoading), [dashboardData, isDashboardLoading]);
  const bookingActions = useMemo(() => buildClientBookingActions(dashboardData.bookings), [dashboardData.bookings]);
  const caseProgress = useMemo(() => getClientCaseProgress(cases), [cases]);
  const metricHandlers: Record<DashboardMetricId, NavigationHandler> = {
    active: () => onOpenMyBookings?.(),
    upcoming: () => onOpenMyBookings?.(),
    messages: () => onOpenChatPage?.(null, "purchases"),
    actions: () => onOpenMyBookings?.(),
  };

  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setCasesLoading(true);
    const bookingRefresh = fetchClientOverviewSnapshot().then((snapshot) => {
      if (requestId.current !== id) return;
      setDashboardData(snapshot || emptyDashboardData);
      setDashboardError("");
    }).catch(() => {
      if (requestId.current !== id) return;
      setDashboardError("Latest booking times could not be verified. Any displayed schedule may be out of date; retry.");
    }).finally(() => {
      if (requestId.current === id) setIsDashboardLoading(false);
    });
    const caseRefresh = fetchClientOverviewCases().then((result) => {
      if (requestId.current !== id) return;
      setCases(result);
      setCasesError(false);
    }).catch(() => {
      if (requestId.current !== id) return;
      setCases([]);
      setCasesError(true);
    }).finally(() => {
      if (requestId.current === id) setCasesLoading(false);
    });
    await Promise.all([bookingRefresh, caseRefresh]);
  }, []);
  const invalidate = useCallback(() => { requestId.current++; }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setDashboardData(emptyDashboardData); setCases([]); setCasesError(false); setIsDashboardLoading(true); void refresh(); } });
    return () => { active = false; invalidate(); };
  }, [refresh, invalidate, sellerProfile?.userId]);
  useBookingActivity(refresh);

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
            description="Upcoming appointments and agreed replacement visits."
            status={dashboardModel.upcomingCount ? <Badge variant="default">{dashboardModel.upcomingCount} upcoming</Badge> : undefined}
            action={<Button type="button" onClick={onOpenMyBookings}>View all bookings<ArrowRight aria-hidden="true" /></Button>}
          >
            {dashboardModel.upcomingBookings.length ? (
              <div className="divide-y">
                {dashboardModel.upcomingBookings.map((booking) => (
                  <Link to={booking.id != null ? `/bookings?scope=purchases&filter=all&q=${encodeURIComponent(String(booking.id))}&focus=${encodeURIComponent(String(booking.id))}` : "/bookings?scope=purchases"} className="group grid min-h-16 w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:px-5" key={booking.id ?? `${booking.service}-${booking.schedule}`} aria-label={`Open ${booking.service} booking with ${booking.provider}, ${booking.schedule} Philippine time${booking.isReplacement ? ", replacement visit" : ""}`}>
                    <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"><CalendarCheck className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0"><strong className="block text-sm font-semibold leading-5 text-foreground">{booking.service}</strong><span className="mt-1 block text-sm leading-5 text-muted-foreground">{booking.provider} · <strong className="font-semibold text-foreground">{booking.schedule} PHT</strong></span>{booking.isReplacement && <span className="mt-1 block text-xs font-medium leading-4 text-primary">Agreed new time{booking.status === "Dispute Open" ? " · Support case open" : ""}</span>}</span>
                    <Badge variant={booking.isReplacement ? "default" : booking.status === "Payment Confirmed" ? "success" : "outline"} className="w-fit">{booking.isReplacement ? "Replacement visit" : booking.status}</Badge>
                    <ArrowRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <WorkflowEmptyState
                icon={CalendarPlus}
                tone="primary"
                title={isDashboardLoading ? "Checking your schedule…" : dashboardError ? "Schedule unavailable" : "No upcoming services"}
                description={isDashboardLoading ? "We’re loading your latest bookings." : dashboardError ? "We couldn’t verify the latest visit time. Retry before relying on an older appointment." : "When you book a provider, the date, time, and current status will appear here."}
                action={!isDashboardLoading ? dashboardError ? <Button type="button" variant="outline" onClick={() => { void refresh(); }}>Retry schedule</Button> : <Button type="button" onClick={onOpenBrowseServices}><Search aria-hidden="true" />Find a service</Button> : undefined}
              />
            )}
          </WorkflowPanel>

          <WorkflowPanel
            icon={BellRing}
            tone="primary"
            title="Recent updates"
            description="Latest booking and message activity."
            status={dashboardModel.recentUpdates.length ? <Badge variant="secondary">Latest {dashboardModel.recentUpdates.length}</Badge> : undefined}
          >
            {dashboardModel.recentUpdates.length ? (
              <ol className="divide-y">
                {dashboardModel.recentUpdates.map((update) => <li key={update.id}>
                  {update.href ? <Link to={update.href} className="flex min-h-16 gap-3 px-4 py-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"><RecentUpdateContent update={update} linked /></Link>
                    : <div className="flex min-h-16 gap-3 px-4 py-4 sm:px-5"><RecentUpdateContent update={update} linked={false} /></div>}
                </li>)}
              </ol>
            ) : (
              <WorkflowEmptyState icon={BellRing} title={isDashboardLoading ? "Loading recent activity…" : dashboardError ? "Updates unavailable" : "You’re all caught up"} description={isDashboardLoading ? "We’re checking bookings and messages." : dashboardError ? "Refresh the dashboard to check for new updates." : "New booking and message updates will appear here."} />
            )}
          </WorkflowPanel>
        </section>

        <div className="mt-4">
          <ClientNextSteps actions={bookingActions} caseProgress={caseProgress} casesError={casesError}
            casesLoading={casesLoading} onRetryCases={() => { void refresh(); }} />
        </div>
      </main>
    </div>
  );
}
