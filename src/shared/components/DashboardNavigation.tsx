import { useEffect, useState, type ChangeEvent, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  CalendarCheck,
  ChevronRight,
  Home,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  Shield,
  Store,
  UserRound,
} from "lucide-react";

import { paths } from "@/app/router/routes";
import { NotificationCenter, useRealtimeNotifications } from "@/components/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LogoutConfirmModal from "@/features/auth/components/LogoutConfirmModal";
import { cn } from "@/lib/utils";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";
import BrandWordmark from "./BrandWordmark";

const WORKER_ROLES = new Set(["worker", "workers", "seller", "sellers"]);
const CLIENT_ROLES = new Set(["client", "clients", "buyer", "buyers", "customer", "customers"]);
const PROVIDER_VIEWS = new Set(["worker-dashboard", "worker-bookings", "my-work"]);
const CLIENT_VIEWS = new Set(["client-dashboard", "browse-services", "my-bookings"]);

export interface DashboardProfile {
  userId?: string;
  user_id?: string;
  role?: string;
  isAdmin?: boolean;
  isWorker?: boolean;
  is_worker?: boolean;
  sellerId?: string;
  workerProfileId?: string;
  profilePhoto?: string | null;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

export interface DashboardNavigationProps {
  searchQuery?: string;
  onSearchChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onLogout?: () => void | Promise<void>;
  onOpenSellerSetup?: () => void;
  onOpenMyBookings?: () => void;
  sellerProfile?: DashboardProfile | null;
  onOpenMyWork?: () => void;
  onOpenProfile?: () => void;
  onOpenAccountSettings?: () => void;
  onOpenSettings?: () => void;
  currentView?: string;
  onOpenDashboard?: () => void;
  onOpenBrowseServices?: () => void;
  onOpenChatPage?: () => void;
  onToggleAdminView?: () => void;
  isAdminView?: boolean;
}

type NavKey = "home" | "overview" | "browse" | "chat" | "bookings" | "work" | "profile" | "settings";
interface NavItem { key: NavKey; label: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; onClick?: () => void }

function isWorkerProfile(profile?: DashboardProfile | null) {
  const role = String(profile?.role || "").trim().toLowerCase();
  if (CLIENT_ROLES.has(role)) return false;
  if (WORKER_ROLES.has(role)) return true;
  return !role && Boolean(profile?.isWorker || profile?.is_worker || profile?.sellerId || profile?.workerProfileId);
}

const desktopNavClass = "group relative flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const mobileNavClass = "group flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

export default function DashboardNavigation({
  searchQuery = "",
  onSearchChange,
  onLogout,
  onOpenSellerSetup,
  onOpenMyBookings,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  currentView = "client-dashboard",
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenChatPage,
  onToggleAdminView,
  isAdminView = false,
}: DashboardNavigationProps) {
  const navigate = useNavigate();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [workerWorkspace, setWorkerWorkspace] = useState(() => localStorage.getItem("trabawho-worker-workspace") || "provider");
  const { notifications, isLoading, error, markRead, markAllRead, retry } = useRealtimeNotifications(sellerProfile?.userId || sellerProfile?.user_id);

  useEffect(() => {
    document.body.classList.add("gl-app-shell-active");
    return () => document.body.classList.remove("gl-app-shell-active");
  }, []);

  const activeKey: NavKey = ({
    "client-dashboard": "home",
    "browse-services": "browse",
    chat: "chat",
    "my-bookings": "bookings",
    "worker-bookings": "bookings",
    "my-work": "work",
    "worker-dashboard": "overview",
    profile: "profile",
    "account-settings": "profile",
    settings: "settings",
  } as Record<string, NavKey>)[currentView] || "home";
  const role = String(sellerProfile?.role || "").trim().toLowerCase();
  const isAdminAccount = Boolean(sellerProfile?.isAdmin) || role === "admin";
  const isWorkerAccount = isWorkerProfile(sellerProfile);
  const routeWorkspace = PROVIDER_VIEWS.has(currentView) ? "provider" : CLIENT_VIEWS.has(currentView) ? "client" : null;
  const resolvedWorkspace = routeWorkspace || workerWorkspace;
  const isProviderWorkspace = isWorkerAccount && resolvedWorkspace === "provider";
  const showGlobalSearch = currentView !== "browse-services";
  const profilePhotoUrl = getProfilePhotoUrl(sellerProfile?.profilePhoto);
  const displayName = sellerProfile?.fullName || [sellerProfile?.firstName, sellerProfile?.lastName].filter(Boolean).join(" ") || "TrabaWho member";
  const workspaceLabel = isProviderWorkspace ? "Provider workspace" : "Client workspace";
  const workspaceDescription = isProviderWorkspace ? "Manage jobs and services" : "Book trusted local help";

  useEffect(() => {
    if (!isWorkerAccount) return;
    if (routeWorkspace) localStorage.setItem("trabawho-worker-workspace", routeWorkspace);
  }, [isWorkerAccount, routeWorkspace]);

  const switchWorkerWorkspace = () => {
    const nextWorkspace = isProviderWorkspace ? "client" : "provider";
    setWorkerWorkspace(nextWorkspace);
    localStorage.setItem("trabawho-worker-workspace", nextWorkspace);
    void navigate(nextWorkspace === "provider" ? paths.workerDashboard : paths.dashboard);
  };

  const openWorkspaceHome = () => {
    if (isProviderWorkspace) void navigate(paths.workerDashboard);
    else onOpenDashboard?.();
  };
  const clientNavItems: NavItem[] = [
    { key: "home", label: "Home", icon: Home, onClick: onOpenDashboard },
    { key: "browse", label: "Browse", icon: Store, onClick: onOpenBrowseServices || onOpenDashboard },
    { key: "chat", label: "Chats", icon: MessageCircle, onClick: onOpenChatPage || onOpenMyBookings },
    { key: "bookings", label: "Bookings", icon: CalendarCheck, onClick: () => { void navigate(`${paths.bookings}?scope=purchases`); } },
  ];
  const workerNavItems: NavItem[] = [
    { key: "overview", label: "Overview", icon: Home, onClick: () => { void navigate(paths.workerDashboard); } },
    { key: "work", label: "My Work", icon: BriefcaseBusiness, onClick: onOpenMyWork || onOpenSellerSetup },
    { key: "chat", label: "Messages", icon: MessageCircle, onClick: onOpenChatPage || onOpenMyBookings },
    { key: "bookings", label: "Bookings", icon: CalendarCheck, onClick: () => { void navigate(`${paths.workerBookings}?scope=incoming`); } },
  ];
  const navItems = isWorkerAccount && !isAdminAccount && isProviderWorkspace ? workerNavItems : clientNavItems;

  const handleNotificationClick = (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    markRead(id);
    setIsNotificationOpen(false);
    if (notification?.type === "message") return (onOpenChatPage || onOpenMyBookings)?.();
    if (isWorkerAccount && !isAdminAccount) return onOpenMyWork?.();
    onOpenMyBookings?.();
  };

  const renderNavButtons = (mobile = false) => (
    <nav className={cn("grid gap-1", mobile && "grid-cols-4")} aria-label={mobile ? "Mobile dashboard navigation" : "Dashboard navigation"}>
      {navItems.map(({ key, label, icon: Icon, onClick }) => {
        const active = activeKey === key;
        return (
          <button key={key} type="button" className={cn(mobile ? mobileNavClass : desktopNavClass, active && !mobile && "bg-primary/10 text-primary", active && mobile && "font-semibold text-primary")} aria-current={active ? "page" : undefined} aria-label={mobile ? `${label} tab` : label} title={label} onClick={() => onClick?.()}>
            {!mobile && <span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r bg-transparent", active && "bg-primary")} />}
            {mobile ? (
              <span className={cn("relative flex h-7 min-w-12 items-center justify-center rounded-full transition-colors group-hover:bg-muted", active && "bg-primary/10 group-hover:bg-primary/15")}>
                {active ? <span className="absolute -top-1 h-0.5 w-5 rounded-full bg-brand-highlight" aria-hidden="true" /> : null}
                <Icon className="size-5" aria-hidden />
              </span>
            ) : (
              <Icon className={cn("size-8 rounded-lg bg-muted p-2", active && "bg-primary text-primary-foreground")} aria-hidden />
            )}
            <span className="max-w-full truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );

  const renderAccountMenuItems = () => (
    <>
      <DropdownMenuItem onSelect={onOpenProfile}><UserRound />Profile</DropdownMenuItem>
      <DropdownMenuItem onSelect={onOpenAccountSettings || onOpenProfile}><Shield />Account &amp; Privacy</DropdownMenuItem>
      <DropdownMenuItem onSelect={onOpenSettings}><Settings />Settings</DropdownMenuItem>
      {sellerProfile?.role === "admin" && <DropdownMenuItem onSelect={onToggleAdminView}><Shield />{isAdminView ? "Switch to Client View" : "Switch to Admin View"}</DropdownMenuItem>}
      {isWorkerAccount && !isAdminAccount && (
        <DropdownMenuItem
          className="my-1 border border-primary/20 bg-primary/10 font-semibold text-primary focus:bg-primary/15 focus:text-primary [&>svg]:text-primary"
          onSelect={switchWorkerWorkspace}
        >
          <BriefcaseBusiness />
          {isProviderWorkspace ? "Switch to client workspace" : "Switch to provider workspace"}
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => setIsLogoutModalOpen(true)}><LogOut />Logout</DropdownMenuItem>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-[140] hidden w-[248px] flex-col gap-[18px] border-r bg-background/95 px-3.5 pb-3.5 pt-[18px] shadow-[10px_0_30px_rgba(15,23,42,0.04)] backdrop-blur min-[881px]:flex">
        <button type="button" className="flex min-h-[54px] w-full items-center gap-2.5 rounded-lg px-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={openWorkspaceHome} aria-label="Open home">
          <img className="size-10 shrink-0 object-contain" src="/trabawho-logo.svg" alt="" aria-hidden />
          <span className="min-w-0"><BrandWordmark className="block text-xl leading-none" /><small className="mt-1 block truncate text-[10px] font-semibold text-muted-foreground">Local services marketplace</small></span>
        </button>

        <button type="button" className="grid min-h-[72px] grid-cols-[38px_minmax(0,1fr)_18px] items-center gap-2.5 rounded-lg bg-primary/10 p-2.5 text-left text-foreground hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={isWorkerAccount ? switchWorkerWorkspace : openWorkspaceHome} aria-label={isWorkerAccount ? `Switch to ${isProviderWorkspace ? "client" : "provider"} workspace` : workspaceLabel}>
          <span className="flex size-[38px] items-center justify-center rounded-lg bg-primary text-primary-foreground">{isProviderWorkspace ? <BriefcaseBusiness className="size-[18px]" aria-hidden /> : <Home className="size-[18px]" aria-hidden />}</span>
          <span className="min-w-0"><strong className="block text-[13px] leading-tight">{workspaceLabel}</strong><small className="mt-1 block truncate text-[10px] text-muted-foreground">{workspaceDescription}</small></span>
          {isWorkerAccount ? <ArrowLeftRight className="size-4 text-primary" aria-hidden /> : <ChevronRight className="size-4 text-primary" aria-hidden />}
        </button>

        <section className="grid gap-2" aria-labelledby="workspace-navigation-label">
          <p id="workspace-navigation-label" className="px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Workspace</p>
          {renderNavButtons()}
        </section>

        <div className="mt-auto grid gap-2.5 border-t pt-3">
          <div className="grid gap-1" aria-label="Account shortcuts">
            <Button type="button" variant="ghost" className={cn("justify-start px-2.5 text-muted-foreground", activeKey === "profile" && "bg-accent text-foreground")} onClick={onOpenProfile}><UserRound />Profile</Button>
            <Button type="button" variant="ghost" className={cn("justify-start px-2.5 text-muted-foreground", activeKey === "settings" && "bg-accent text-foreground")} onClick={onOpenSettings}><Settings />Settings</Button>
          </div>
          <button type="button" className="grid min-h-[58px] w-full grid-cols-[38px_minmax(0,1fr)_20px] items-center gap-2 rounded-lg bg-muted/50 p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onOpenProfile} aria-label="Open profile">
            <img className="size-[38px] rounded-lg object-cover" src={profilePhotoUrl} alt="" />
            <span className="min-w-0"><strong className="block truncate text-xs">{displayName}</strong><small className="mt-1 block truncate text-[10px] text-muted-foreground">{workspaceLabel}</small></span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </button>
          <Button type="button" variant="outline" className="w-full justify-start border-destructive/30 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setIsLogoutModalOpen(true)}>
            <LogOut aria-hidden />
            Log out
          </Button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-[130] flex min-h-16 items-center justify-between gap-3.5 border-b bg-background/95 px-3 backdrop-blur min-[881px]:left-[248px] min-[881px]:px-6">
        <button type="button" className="flex min-w-0 items-center gap-2 text-left min-[881px]:hidden" onClick={openWorkspaceHome} aria-label="Open home"><img className="size-9 object-contain" src="/trabawho-logo.svg" alt="" aria-hidden /><BrandWordmark className="text-[22px]" /></button>
        {showGlobalSearch && <label className="relative hidden w-[min(560px,44vw)] items-center min-[881px]:flex"><span className="sr-only">Search</span><Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden /><input className="min-h-10 w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" value={searchQuery} onChange={onSearchChange} placeholder="Search services, providers, locations" /></label>}
        <div className="ml-auto flex items-center gap-1">
          {showGlobalSearch && <Button type="button" variant="ghost" size="icon" className="min-[881px]:hidden" aria-label="Open search" aria-pressed={showMobileSearch} onClick={() => setShowMobileSearch((value) => !value)}><Search aria-hidden /></Button>}
          <NotificationCenter notifications={notifications} open={isNotificationOpen} onOpenChange={(open) => { if (open) setIsProfileMenuOpen(false); setIsNotificationOpen(open); }} onMarkAllRead={markAllRead} onNotificationClick={handleNotificationClick} isLoading={isLoading} error={error} onRetry={retry} />
          <DropdownMenu open={isProfileMenuOpen} onOpenChange={(open) => { if (open) setIsNotificationOpen(false); setIsProfileMenuOpen(open); }}>
            <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="rounded-full p-0.5 min-[881px]:hidden" aria-label="Profile menu"><img className="size-10 rounded-full object-cover" src={profilePhotoUrl} alt="Profile" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {renderAccountMenuItems()}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {showGlobalSearch && showMobileSearch && <div className="absolute inset-x-0 top-16 border-b bg-background p-3 shadow-sm min-[881px]:hidden"><label className="relative flex items-center"><span className="sr-only">Search</span><Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden /><input className="min-h-11 w-full rounded-lg border bg-background py-2 pl-9 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" value={searchQuery} onChange={onSearchChange} placeholder="Search services, providers, locations" /></label></div>}
      </header>

      <div className="fixed inset-x-0 bottom-0 z-[140] border-t bg-background/95 px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur min-[881px]:hidden">{renderNavButtons(true)}</div>
      <LogoutConfirmModal isOpen={isLogoutModalOpen} onCancel={() => setIsLogoutModalOpen(false)} onConfirm={async () => { setIsLogoutModalOpen(false); await onLogout?.(); }} />
    </>
  );
}
