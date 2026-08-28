import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  Home,
  LogOut,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Shield,
  Store,
  Sun,
  UserRound,
} from 'lucide-react';
import LogoutConfirmModal from '../../features/auth/components/LogoutConfirmModal';
import { getProfilePhotoUrl } from '../utils/profilePhoto';
import BrandWordmark from './BrandWordmark';

const WORKER_ROLE_VALUES = new Set(['worker', 'workers', 'seller', 'sellers']);
const CLIENT_ROLE_VALUES = new Set(['client', 'clients', 'buyer', 'buyers', 'customer', 'customers']);

const isWorkerProfile = (profile = {}) => {
  const normalizedRole = String(profile?.role || '').trim().toLowerCase();
  if (CLIENT_ROLE_VALUES.has(normalizedRole)) return false;
  if (WORKER_ROLE_VALUES.has(normalizedRole)) return true;
  return !normalizedRole && Boolean(profile?.isWorker || profile?.is_worker || profile?.sellerId || profile?.workerProfileId);
};

function DashboardNavigation({
  appTheme = 'light',
  themeMode = 'system',
  onThemeChange,
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
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 'n1', title: 'Booking update', message: 'Your latest booking has a new message.', isRead: false },
    { id: 'n2', title: 'Schedule reminder', message: 'You have an upcoming schedule today.', isRead: false },
  ]);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('gl-app-shell-active');
    return () => document.body.classList.remove('gl-app-shell-active');
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeKey = {
    'client-dashboard': 'home',
    'browse-services': 'browse',
    chat: 'chat',
    'my-bookings': 'bookings',
    'my-work': 'work',
    'worker-dashboard': 'work',
    profile: 'profile',
    'account-settings': 'profile',
    settings: 'settings',
  }[currentView] || 'home';

  const profilePhotoUrl = getProfilePhotoUrl(sellerProfile?.profilePhoto);
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const isDarkMode = appTheme === 'dark';
  const ThemeIcon = isDarkMode ? Moon : Sun;
  const normalizedRole = String(sellerProfile?.role || '').trim().toLowerCase();
  const isAdminAccount = Boolean(sellerProfile?.isAdmin) || normalizedRole === 'admin';
  const isWorkerAccount = isWorkerProfile(sellerProfile);
  const handleThemeToggle = () => {
    onThemeChange?.(isDarkMode ? 'light' : 'dark');
  };

  const clientNavItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onOpenDashboard },
    { key: 'browse', label: 'Browse', icon: Store, onClick: onOpenBrowseServices || onOpenDashboard },
    { key: 'chat', label: 'Chats', icon: MessageCircle, onClick: onOpenChatPage || onOpenMyBookings },
    { key: 'bookings', label: 'Bookings', icon: CalendarCheck, onClick: onOpenMyBookings },
  ];
  const workerNavItems = [
    { key: 'home', label: 'Home', icon: Home, onClick: onOpenDashboard },
    { key: 'work', label: 'My Work', icon: BriefcaseBusiness, onClick: onOpenMyWork || onOpenSellerSetup },
    { key: 'chat', label: 'Chats', icon: MessageCircle, onClick: onOpenChatPage || onOpenMyBookings },
    { key: 'bookings', label: 'Bookings', icon: CalendarCheck, onClick: onOpenMyBookings },
  ];
  const navItems = isWorkerAccount && !isAdminAccount ? workerNavItems : clientNavItems;
  const mobileNavLabels = {
    home: 'Mobile home tab',
    browse: 'Mobile browse tab',
    chat: 'Mobile chats tab',
    bookings: 'Mobile bookings tab',
    work: 'Mobile work tab',
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const handleNotificationClick = (id) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setIsNotificationOpen(false);
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
        <button type="button" className="gl-app-brand" onClick={() => onOpenDashboard?.()} aria-label="Open home">
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" />
          <strong><BrandWordmark /></strong>
        </button>

        <div className="gl-app-sidebar-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={searchQuery || ''}
            onChange={(event) => onSearchChange?.(event)}
            placeholder="Search"
          />
        </div>

        {renderNavButtons()}

        <button
          type="button"
          className="gl-app-theme-toggle"
          onClick={handleThemeToggle}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDarkMode}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="gl-app-theme-icon">
            <ThemeIcon size={17} aria-hidden="true" />
          </span>
          <span>
            <strong>{isDarkMode ? 'Dark mode' : 'Light mode'}</strong>
            <small>{themeMode === 'system' ? 'Device theme active' : `Click for ${isDarkMode ? 'light' : 'dark'}`}</small>
          </span>
        </button>

      </aside>

      <header className="gl-app-topbar">
        <button type="button" className="gl-app-mobile-brand" onClick={() => onOpenDashboard?.()} aria-label="Open home">
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" />
          <strong><BrandWordmark /></strong>
        </button>

        <div className="gl-app-topbar-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={searchQuery || ''}
            onChange={(event) => onSearchChange?.(event)}
            placeholder="Search services, providers, locations"
          />
        </div>

        <div className="gl-app-topbar-actions">
          <button
            type="button"
            className="gl-app-icon-btn mobile-only"
            aria-label="Open search"
            aria-pressed={showMobileSearch}
            onClick={() => setShowMobileSearch((value) => !value)}
          >
            <Search size={18} aria-hidden="true" />
          </button>

          <div ref={notificationRef} className="gl-app-menu-anchor">
            <button type="button" className="gl-app-icon-btn" aria-label="Notifications" onClick={() => setIsNotificationOpen((value) => !value)}>
              <Bell size={18} aria-hidden="true" />
              {unreadCount > 0 && <span className="gl-app-dot" />}
            </button>

            {isNotificationOpen && (
              <div className="gl-app-dropdown">
                <div className="gl-app-dropdown-head">
                  <p>Notifications</p>
                  <button type="button" onClick={markAllNotificationsRead}>Mark all read</button>
                </div>
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`gl-app-notification ${item.isRead ? '' : 'unread'}`}
                    onClick={() => handleNotificationClick(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={profileRef} className="gl-app-menu-anchor">
            <button type="button" className="gl-app-icon-btn avatar" aria-label="Profile menu" onClick={() => setIsProfileMenuOpen((value) => !value)}>
              <img src={profilePhotoUrl} alt="Profile" />
            </button>

            {isProfileMenuOpen && (
              <div className="gl-app-dropdown">
                <button type="button" className="gl-app-menu-button" onClick={() => { setIsProfileMenuOpen(false); onOpenProfile?.(); }}>
                  <UserRound size={16} aria-hidden="true" /> Profile
                </button>
                <button type="button" className="gl-app-menu-button" onClick={() => { setIsProfileMenuOpen(false); (onOpenAccountSettings || onOpenProfile)?.(); }}>
                  <Shield size={16} aria-hidden="true" /> Account & Privacy
                </button>
                <button type="button" className="gl-app-menu-button" onClick={() => { setIsProfileMenuOpen(false); onOpenSettings?.(); }}>
                  <Settings size={16} aria-hidden="true" /> Settings
                </button>
                {sellerProfile?.role === 'admin' && (
                  <button type="button" className="gl-app-menu-button" onClick={() => { setIsProfileMenuOpen(false); onToggleAdminView?.(); }}>
                    <Shield size={16} aria-hidden="true" /> {isAdminView ? 'Switch to Client View' : 'Switch to Admin View'}
                  </button>
                )}
                <button type="button" className="gl-app-menu-button danger" onClick={() => { setIsProfileMenuOpen(false); setIsLogoutModalOpen(true); }}>
                  <LogOut size={16} aria-hidden="true" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`gl-app-mobile-search ${showMobileSearch ? 'open' : ''}`}>
          <input
            value={searchQuery || ''}
            onChange={(event) => onSearchChange?.(event)}
            placeholder="Search services, providers, locations"
          />
        </div>
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
