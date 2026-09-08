import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import LogoutConfirmModal from '../../features/auth/components/LogoutConfirmModal';
import { NotificationCenter, useRealtimeNotifications } from '../../components/notifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { getProfilePhotoUrl } from '../utils/profilePhoto';
import BrandWordmark from './BrandWordmark';
import { paths } from '../../app/router/routes';

const WORKER_ROLE_VALUES = new Set(['worker', 'workers', 'seller', 'sellers']);
const CLIENT_ROLE_VALUES = new Set(['client', 'clients', 'buyer', 'buyers', 'customer', 'customers']);

const isWorkerProfile = (profile = {}) => {
  const normalizedRole = String(profile?.role || '').trim().toLowerCase();
  if (CLIENT_ROLE_VALUES.has(normalizedRole)) return false;
  if (WORKER_ROLE_VALUES.has(normalizedRole)) return true;
  return !normalizedRole && Boolean(profile?.isWorker || profile?.is_worker || profile?.sellerId || profile?.workerProfileId);
};

function DashboardNavigation({
  searchQuery,
  onSearchChange,
  onLogout,
  onOpenSellerSetup,
  onOpenMyBookings,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  currentView,
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenChatPage,
  onToggleAdminView,
  isAdminView = false,
}) {
  const navigate = useNavigate();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [workerWorkspace, setWorkerWorkspace] = useState(() => localStorage.getItem('trabawho-worker-workspace') || 'provider');
  const {
    notifications,
    isLoading: notificationsLoading,
    error: notificationsError,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    retry: retryNotifications,
  } = useRealtimeNotifications(sellerProfile?.userId || sellerProfile?.user_id);

  useEffect(() => {
    document.body.classList.add('gl-app-shell-active');
    return () => document.body.classList.remove('gl-app-shell-active');
  }, []);

  const activeKey = {
    'client-dashboard': 'home',
    'browse-services': 'browse',
    chat: 'chat',
    'my-bookings': 'bookings',
    'worker-bookings': 'bookings',
    'my-work': 'work',
    'worker-dashboard': 'overview',
    profile: 'profile',
    'account-settings': 'profile',
    settings: 'settings',
  }[currentView] || 'home';

  const profilePhotoUrl = getProfilePhotoUrl(sellerProfile?.profilePhoto);
  const normalizedRole = String(sellerProfile?.role || '').trim().toLowerCase();
  const isAdminAccount = Boolean(sellerProfile?.isAdmin) || normalizedRole === 'admin';
  const isWorkerAccount = isWorkerProfile(sellerProfile);
  const isProviderWorkspace = isWorkerAccount && workerWorkspace === 'provider';
  const showGlobalSearch = currentView !== 'browse-services';
  const displayName = sellerProfile?.fullName
    || [sellerProfile?.firstName, sellerProfile?.lastName].filter(Boolean).join(' ')
    || 'TrabaWho member';
  const workspaceLabel = isProviderWorkspace ? 'Provider workspace' : 'Client workspace';
  const workspaceDescription = isProviderWorkspace ? 'Manage jobs and services' : 'Book trusted local help';
  const clientNavItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onOpenDashboard },
    { key: 'browse', label: 'Browse', icon: Store, onClick: onOpenBrowseServices || onOpenDashboard },
    { key: 'chat', label: 'Chats', icon: MessageCircle, onClick: onOpenChatPage || onOpenMyBookings },
    { key: 'bookings', label: 'Bookings', icon: CalendarCheck, onClick: () => navigate(`${paths.bookings}?scope=purchases`) },
  ];
  const workerNavItems = [
    { key: 'overview', label: 'Overview', icon: Home, onClick: () => navigate(paths.workerDashboard) },
    { key: 'work', label: 'My Work', icon: BriefcaseBusiness, onClick: onOpenMyWork || onOpenSellerSetup },
    { key: 'chat', label: 'Messages', icon: MessageCircle, onClick: onOpenChatPage || onOpenMyBookings },
    { key: 'bookings', label: 'Bookings', icon: CalendarCheck, onClick: () => navigate(`${paths.workerBookings}?scope=incoming`) },
  ];
  const navItems = isWorkerAccount && !isAdminAccount && isProviderWorkspace ? workerNavItems : clientNavItems;
  const mobileNavLabels = {
    home: 'Mobile home tab',
    overview: 'Mobile overview tab',
    browse: 'Mobile browse tab',
    chat: 'Mobile chats tab',
    bookings: 'Mobile bookings tab',
    work: 'Mobile work tab',
  };

  useEffect(() => {
    if (!isWorkerAccount) return;
    const nextWorkspace = ['worker-dashboard', 'worker-bookings', 'my-work'].includes(currentView)
      ? 'provider'
      : ['client-dashboard', 'browse-services', 'my-bookings'].includes(currentView)
        ? 'client'
        : null;
    if (!nextWorkspace) return;
    setWorkerWorkspace(nextWorkspace);
    localStorage.setItem('trabawho-worker-workspace', nextWorkspace);
  }, [currentView, isWorkerAccount]);

  const switchWorkerWorkspace = () => {
    const nextWorkspace = isProviderWorkspace ? 'client' : 'provider';
    setWorkerWorkspace(nextWorkspace);
    localStorage.setItem('trabawho-worker-workspace', nextWorkspace);
    navigate(nextWorkspace === 'provider' ? paths.workerDashboard : paths.dashboard);
  };

  const openWorkspaceHome = () => {
    if (isProviderWorkspace) navigate(paths.workerDashboard);
    else onOpenDashboard?.();
  };

  const handleNotificationClick = (id) => {
    const notification = notifications.find((item) => item.id === id);
    markNotificationRead(id);
    setIsNotificationOpen(false);
    if (notification?.type === 'message') {
      (onOpenChatPage || onOpenMyBookings)?.();
      return;
    }
    if (isWorkerAccount && !isAdminAccount) {
      onOpenMyWork?.();
      return;
    }
    onOpenMyBookings?.();
  };

  const renderNavButtons = (variant = 'desktop') => (
    <nav className="gl-app-nav-list" aria-label={variant === 'mobile' ? 'Mobile dashboard navigation' : 'Dashboard navigation'}>
      {navItems.map(({ key, label, icon: Icon, onClick }) => (
        <button
          key={key}
          type="button"
          className={`gl-app-nav-item ${activeKey === key ? 'active' : ''}`}
          aria-label={variant === 'mobile' ? mobileNavLabels[key] : label}
          title={label}
          onClick={() => onClick?.()}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="gl-app-sidebar">
        <button type="button" className="gl-app-brand" onClick={openWorkspaceHome} aria-label="Open home">
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" />
          <span>
            <strong><BrandWordmark /></strong>
            <small>Local services marketplace</small>
          </span>
        </button>

        <button
          type="button"
          className="gl-app-workspace-card"
          onClick={isWorkerAccount ? switchWorkerWorkspace : openWorkspaceHome}
          aria-label={isWorkerAccount
            ? `Switch to ${isProviderWorkspace ? 'client' : 'provider'} workspace`
            : workspaceLabel}
        >
          <span className="gl-app-workspace-icon">
            {isProviderWorkspace ? <BriefcaseBusiness aria-hidden="true" /> : <Home aria-hidden="true" />}
          </span>
          <span>
            <strong>{workspaceLabel}</strong>
            <small>{workspaceDescription}</small>
          </span>
          {isWorkerAccount
            ? <ArrowLeftRight className="gl-app-workspace-action" aria-hidden="true" />
            : <ChevronRight className="gl-app-workspace-action" aria-hidden="true" />}
        </button>

        <div className="gl-app-nav-section">
          <p className="gl-app-nav-label">Workspace</p>
          {renderNavButtons()}
        </div>

        <div className="gl-app-sidebar-footer">
          <div className="gl-app-sidebar-utilities" aria-label="Account shortcuts">
            <button type="button" onClick={() => onOpenProfile?.()} className={activeKey === 'profile' ? 'active' : ''}>
              <UserRound aria-hidden="true" />
              Profile
            </button>
            <button type="button" onClick={() => onOpenSettings?.()} className={activeKey === 'settings' ? 'active' : ''}>
              <Settings aria-hidden="true" />
              Settings
            </button>
          </div>
          <button type="button" className="gl-app-sidebar-account" onClick={() => onOpenProfile?.()}>
            <img src={profilePhotoUrl} alt="" />
            <span>
              <strong>{displayName}</strong>
              <small>{workspaceLabel}</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </aside>

      <header className={`gl-app-topbar ${showGlobalSearch ? '' : 'no-search'}`}>
        <button type="button" className="gl-app-mobile-brand" onClick={openWorkspaceHome} aria-label="Open home">
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" />
          <strong><BrandWordmark /></strong>
        </button>

        {showGlobalSearch && (
          <div className="gl-app-topbar-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={searchQuery || ''}
              onChange={(event) => onSearchChange?.(event)}
              placeholder="Search services, providers, locations"
            />
          </div>
        )}

        <div className="gl-app-topbar-actions">
          {showGlobalSearch && (
            <button
              type="button"
              className="gl-app-icon-btn mobile-only"
              aria-label="Open search"
              aria-pressed={showMobileSearch}
              onClick={() => setShowMobileSearch((value) => !value)}
            >
              <Search size={18} aria-hidden="true" />
            </button>
          )}

          <NotificationCenter
            notifications={notifications}
            open={isNotificationOpen}
            onOpenChange={(open) => {
              if (open) setIsProfileMenuOpen(false);
              setIsNotificationOpen(open);
            }}
            onMarkAllRead={markAllNotificationsRead}
            onNotificationClick={handleNotificationClick}
            isLoading={notificationsLoading}
            error={notificationsError}
            onRetry={retryNotifications}
          />

          <DropdownMenu
            open={isProfileMenuOpen}
            onOpenChange={(open) => {
              if (open) setIsNotificationOpen(false);
              setIsProfileMenuOpen(open);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button type="button" className="gl-app-icon-btn avatar" aria-label="Profile menu">
                <img src={profilePhotoUrl} alt="Profile" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={() => onOpenProfile?.()}>
                <UserRound aria-hidden="true" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => (onOpenAccountSettings || onOpenProfile)?.()}>
                <Shield aria-hidden="true" /> Account &amp; Privacy
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpenSettings?.()}>
                <Settings aria-hidden="true" /> Settings
              </DropdownMenuItem>
              {sellerProfile?.role === 'admin' && (
                <DropdownMenuItem onSelect={() => onToggleAdminView?.()}>
                  <Shield aria-hidden="true" /> {isAdminView ? 'Switch to Client View' : 'Switch to Admin View'}
                </DropdownMenuItem>
              )}
              {isWorkerAccount && !isAdminAccount && (
                <DropdownMenuItem onSelect={switchWorkerWorkspace}>
                  <BriefcaseBusiness aria-hidden="true" /> {isProviderWorkspace ? 'Switch to client workspace' : 'Switch to provider workspace'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => setIsLogoutModalOpen(true)}>
                <LogOut aria-hidden="true" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showGlobalSearch && (
          <div className={`gl-app-mobile-search ${showMobileSearch ? 'open' : ''}`}>
            <input
              value={searchQuery || ''}
              onChange={(event) => onSearchChange?.(event)}
              placeholder="Search services, providers, locations"
            />
          </div>
        )}
      </header>

      <div className="gl-app-mobile-nav">
        {renderNavButtons('mobile')}
      </div>

      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onCancel={() => setIsLogoutModalOpen(false)}
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          onLogout?.();
        }}
      />
    </>
  );
}

export default DashboardNavigation;
