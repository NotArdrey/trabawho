import { useEffect, useState } from 'react';
// ============================================================================
// HEADER COMPONENT - Navigation & Notification Center
// ============================================================================
// Purpose: Sticky navigation bar used on every page (Desktop & Mobile)
// Parent: Called from App.js layout, passed via Header prop in each page
// Features:
//   - Logo + Responsive search box (intent-focused placeholder per service-first design)
//   - Desktop: Inline navigation buttons | Mobile: Hamburger menu drawer
//   - Notification center with bell icon (shows unread count badge)
//   - Profile avatar + dropdown menu (Profile, My Bookings, Account, Logout, etc.)
//   - Theme & responsive behavior with window.innerWidth breakpoint at 900px
// State Management: Uses useState for menu open/close and notification visibility
// Architecture: Child component that receives callbacks from parent (Dashboard, MyBookings, etc.)
//   Callbacks pushed down: onLogout, onOpenMyBookings, onOpenMyWork, onOpenProfile, etc.
// ============================================================================

import LogoutConfirmModal from '../../features/auth/components/LogoutConfirmModal';
import BrandWordmark from './BrandWordmark';
import { getProfilePhotoUrl } from '../utils/profilePhoto';


function Header({ searchQuery, onSearchChange, onLogout, onOpenSellerSetup, onOpenMyBookings, sellerProfile, onOpenMyWork, onGoHome, onOpenProfile, onOpenAccountSettings, onOpenSettings, externalNotifications = [], searchPlaceholder = 'Search for services...' }) {
  // ============================================================================
  // LOCAL STATE - Header UI State Management
  // ============================================================================
  // Menu visibility states (mutually exclusive - prevents multiple menus open)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false); // Profile dropdown toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile hamburger menu drawer
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false); // Logout confirmation modal
  const [isNotificationOpen, setIsNotificationOpen] = useState(false); // Notification center dropdown
  
  // ============================================================================
  // NOTIFICATIONS STATE - Notification Center with Read Status Tracking
  // ============================================================================
  // Each notification has: id, title, message, time, isRead (flag), type (for routing)
  // Type field determines where to navigate when clicked:
  //   - 'booking': User bookings (client perspective)
  //   - 'work': Worker transactions (seller perspective)
  //   - 'message': Chat-related notifications
  const [notifications, setNotifications] = useState([
    // SAMPLE BOOKING NOTIFICATIONS (client perspective)
    {
      id: 'notif-1',
      title: 'Payment Successful',
      message: 'Your GCash payment for Tutoring was confirmed.',
      time: '2m ago',
      isRead: false,
      type: 'booking',
    },
    {
      id: 'notif-2',
      title: 'Booking Confirmed',
      message: 'Carlo Mendoza accepted your Aircon Cleaning booking.',
      time: '15m ago',
      isRead: false,
      type: 'booking',
    },
    {
      id: 'notif-3',
      title: 'Upcoming Schedule',
      message: 'Reminder: Pet Grooming service is scheduled tomorrow at 2:00 PM.',
      time: '1h ago',
      isRead: true,
      type: 'booking',
    },
    // SAMPLE WORK NOTIFICATIONS (seller perspective)
    {
      id: 'notif-4',
      title: 'New Inquiry',
      message: 'Sarah is interested in your Web Design service.',
      time: '30m ago',
      isRead: false,
      type: 'work',
    },
    {
      id: 'notif-5',
      title: 'Service Completed',
      message: 'Your Math Tutoring session with Alex was marked as completed.',
      time: '3h ago',
      isRead: true,
      type: 'work',
    },
  ]);
  const profilePhotoUrl = getProfilePhotoUrl(sellerProfile?.profilePhoto);
  const [hoveredKey, setHoveredKey] = useState('');
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!externalNotifications || externalNotifications.length === 0) return;

    setNotifications((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      const incoming = externalNotifications.filter((item) => !existingIds.has(item.id));
      return incoming.length > 0 ? [...incoming, ...prev] : prev;
    });
  }, [externalNotifications]);

  const styles = {
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 120,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      padding: '0.9rem 1.25rem',
    },
    inner: {
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '170px minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: '1rem',
    },
    logo: {
      textDecoration: 'none',
      color: 'var(--gl-blue)',
      fontWeight: 850,
      fontSize: 'var(--gl-brand-font-size)',
      fontFamily: "'Poppins', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      letterSpacing: 0,
      lineHeight: 1,
      marginRight: '0.5rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--gl-brand-gap)',
    },
    logoImg: {
      width: 'var(--gl-brand-logo-size)',
      height: 'var(--gl-brand-logo-size)',
      objectFit: 'contain',
      flex: '0 0 auto',
    },
    searchWrap: {
      width: '100%',
      minWidth: 0,
    },
    input: {
      width: '100%',
      height: '44px',
      boxSizing: 'border-box',
      border: '1px solid #cbd5e1',
      borderRadius: '999px',
      padding: '0 1rem',
      fontSize: '0.95rem',
      backgroundColor: '#ffffff',
      color: '#111827',
    },
    actions: {
      marginLeft: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '0.8rem',
      position: 'relative',
      justifySelf: 'end',
      flexShrink: 0,
    },
    primaryButton: {
      border: 'none',
      borderRadius: '8px',
      padding: '0 1rem',
      height: '40px',
      backgroundColor: 'var(--gl-green)',
      color: '#ffffff',
      fontWeight: 700,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    notificationButton: {
      width: '40px',
      height: '40px',
      borderRadius: '999px',
      border: '1px solid #cbd5e1',
      backgroundColor: '#ffffff',
      cursor: 'pointer',
      position: 'relative',
      fontSize: '1rem',
    },
    dot: {
      position: 'absolute',
      top: '7px',
      right: '7px',
      width: '8px',
      height: '8px',
      borderRadius: '999px',
      backgroundColor: '#ef4444',
    },
    dropdown: {
      position: 'absolute',
      right: 0,
      top: '48px',
      width: '320px',
      maxWidth: '90vw',
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.65rem',
      boxShadow: '0 14px 30px rgba(15, 23, 42, 0.2)',
      padding: '0.7rem',
    },
    dropdownHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
    textButton: { border: 'none', background: 'none', color: 'var(--gl-blue)', cursor: 'pointer', fontWeight: 600 },
    notificationItem: {
      width: '100%',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      backgroundColor: '#ffffff',
      textAlign: 'left',
      padding: '0.5rem',
      marginBottom: '0.45rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unreadItem: { backgroundColor: 'var(--gl-accent-soft)', borderColor: 'var(--gl-accent-border)' },
    itemTop: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem' },
    itemTitle: { fontWeight: 700, color: '#1e293b' },
    itemTime: { color: '#64748b', fontSize: '0.78rem' },
    itemMessage: { color: '#334155', fontSize: '0.85rem' },
    avatarButton: {
      width: '40px',
      height: '40px',
      borderRadius: '999px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      padding: 0,
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
    profileMenu: {
      position: 'absolute',
      right: 0,
      top: '48px',
      minWidth: '180px',
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.65rem',
      boxShadow: '0 14px 30px rgba(15, 23, 42, 0.2)',
      padding: '0.3rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
    },
    profileItem: {
      border: 'none',
      backgroundColor: '#ffffff',
      textAlign: 'left',
      padding: '0.5rem 0.55rem',
      borderRadius: '0.45rem',
      cursor: 'pointer',
      color: '#1e293b',
    },
    mobileToggle: {
      border: '1px solid #cbd5e1',
      borderRadius: '0.55rem',
      backgroundColor: '#ffffff',
      padding: '0.45rem 0.55rem',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
    },
    mobileLine: { display: 'block', width: '18px', height: '2px', backgroundColor: '#1e293b' },
    mobileDrawer: {
      marginTop: '0.7rem',
      borderTop: '1px solid #e2e8f0',
      paddingTop: '0.7rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.55rem',
    },
    mobileActions: { display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  };

  const toggleProfileMenu = () => {
    setIsNotificationOpen(false);
    setIsProfileMenuOpen(!isProfileMenuOpen);
  };

  const toggleNotifications = () => {
    setIsProfileMenuOpen(false);
    setIsNotificationOpen((prev) => !prev);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMenus = () => {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
    setIsNotificationOpen(false);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const handleNotificationClick = (id) => {
    // Mark notification as read
    const notif = notifications.find((item) => item.id === id);
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );

    // Navigate based on notification type
    if (notif) {
      setIsNotificationOpen(false); // Close notification dropdown
      
      if (notif.type === 'booking') {
        onOpenMyBookings && onOpenMyBookings();
      } else if (notif.type === 'work') {
        onOpenMyWork && onOpenMyWork();
      } else if (notif.type === 'message') {
        onOpenMyBookings && onOpenMyBookings();
      }
    }
  };

  const requestLogout = () => {
    closeMenus();
    setIsLogoutConfirmOpen(true);
  };

  const handleConfirmLogout = () => {
    setIsLogoutConfirmOpen(false);
    onLogout && onLogout();
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const isDesktop = windowWidth >= 900;

  useEffect(() => {
    if (isDesktop && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [isDesktop, isMobileMenuOpen]);

  const effectiveInnerStyle = isDesktop
    ? styles.inner
    : {
        ...styles.inner,
        gridTemplateColumns: '1fr auto',
      };

  const profileButtonStyle = (key, isLogout) => ({
    ...styles.profileItem,
    color: isLogout ? '#b91c1c' : '#1e293b',
    backgroundColor: hoveredKey === key ? '#f1f5f9' : '#ffffff',
  });

  const isWorkerAccount = Boolean(sellerProfile?.isWorker);

  const primaryActionTheme = isWorkerAccount
    ? { key: 'my-work', base: 'var(--gl-blue)', hover: 'var(--gl-blue-2)' }
    : { key: 'become-seller', base: 'var(--gl-green)', hover: '#059669' };

  const primaryActionStyle = {
    ...styles.primaryButton,
    backgroundColor:
      hoveredKey === primaryActionTheme.key ? primaryActionTheme.hover : primaryActionTheme.base,
  };

  return (
    <header style={styles.header}>
      <div style={effectiveInnerStyle}>
        <a
          href="#dashboard-home"
          style={styles.logo}
          onClick={(event) => {
            closeMenus();
            if (onGoHome) {
              event.preventDefault();
              onGoHome();
            }
          }}
        >
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" style={styles.logoImg} />
          <BrandWordmark />
        </a>

        {isDesktop && <div style={styles.searchWrap}>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={onSearchChange}
            style={styles.input}
          />
        </div>}

        {isDesktop && <div style={styles.actions}>
          {isWorkerAccount ? (
            <button
              style={primaryActionStyle}
              onMouseEnter={() => setHoveredKey('my-work')}
              onMouseLeave={() => setHoveredKey('')}
              onClick={onOpenMyWork}
            >
              My Work
            </button>
          ) : (
            <button
              style={primaryActionStyle}
              onMouseEnter={() => setHoveredKey('become-seller')}
              onMouseLeave={() => setHoveredKey('')}
              onClick={onOpenSellerSetup}
            >
              Become a Seller
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <button
              style={styles.notificationButton}
              aria-label="Notifications"
              onClick={toggleNotifications}
            >
              <span aria-hidden="true">&#128276;</span>
              {unreadCount > 0 && <span style={styles.dot}></span>}
            </button>

            {isNotificationOpen && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <p>Notifications</p>
                  <button
                    type="button"
                    style={styles.textButton}
                    onClick={markAllNotificationsRead}
                  >
                    Mark all as read
                  </button>
                </div>

                <div>
                  {notifications.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No notifications yet.</p>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        style={{ ...styles.notificationItem, ...(!item.isRead ? styles.unreadItem : {}) }}
                        onClick={() => handleNotificationClick(item.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = item.isRead ? 'var(--gl-surface-2)' : 'var(--gl-accent-soft)';
                          e.currentTarget.style.borderColor = item.isRead ? 'var(--gl-border-strong)' : 'var(--gl-accent-border)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = item.isRead ? 'var(--gl-surface)' : 'var(--gl-accent-soft)';
                          e.currentTarget.style.borderColor = item.isRead ? 'var(--gl-border)' : 'var(--gl-accent-border)';
                        }}
                      >
                        <div>
                          <div style={styles.itemTop}>
                            <span style={styles.itemTitle}>{item.title}</span>
                            <span style={styles.itemTime}>{item.time}</span>
                          </div>
                          <span style={styles.itemMessage}>{item.message}</span>
                        </div>
                        <span style={{ flex: 'none', marginLeft: '0.5rem', fontSize: '1.2rem', color: '#94a3b8' }}>→</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              style={styles.avatarButton}
              onClick={toggleProfileMenu}
              aria-label="Profile menu"
            >
              <img src={profilePhotoUrl} alt="Profile" style={styles.avatarImage} />
            </button>

            {isProfileMenuOpen && (
              <div style={styles.profileMenu}>
                <button style={profileButtonStyle('menu-home')} onMouseEnter={() => setHoveredKey('menu-home')} onMouseLeave={() => setHoveredKey('')} onClick={() => { closeMenus(); onGoHome && onGoHome(); }}>Home</button>
                <button style={profileButtonStyle('menu-profile')} onMouseEnter={() => setHoveredKey('menu-profile')} onMouseLeave={() => setHoveredKey('')} onClick={() => { closeMenus(); onOpenProfile && onOpenProfile(); }}>Profile</button>
                <button style={profileButtonStyle('menu-bookings')} onMouseEnter={() => setHoveredKey('menu-bookings')} onMouseLeave={() => setHoveredKey('')} onClick={onOpenMyBookings}>My Bookings</button>
                <button style={profileButtonStyle('menu-account')} onMouseEnter={() => setHoveredKey('menu-account')} onMouseLeave={() => setHoveredKey('')} onClick={() => { closeMenus(); onOpenProfile && onOpenProfile(); }}>Account Settings</button>
                <button style={profileButtonStyle('menu-pref')} onMouseEnter={() => setHoveredKey('menu-pref')} onMouseLeave={() => setHoveredKey('')} onClick={() => { closeMenus(); onOpenSettings && onOpenSettings(); }}>Preferences</button>
                <button style={profileButtonStyle('menu-logout', true)} onMouseEnter={() => setHoveredKey('menu-logout')} onMouseLeave={() => setHoveredKey('')} onClick={requestLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>}

        {!isDesktop && <button style={styles.mobileToggle} onClick={toggleMobileMenu} aria-label="Toggle menu">
          <span style={styles.mobileLine}></span>
          <span style={styles.mobileLine}></span>
          <span style={styles.mobileLine}></span>
        </button>
        }
      </div>

      {!isDesktop && isMobileMenuOpen && (
        <div style={styles.mobileDrawer}>
          <div style={styles.searchWrap}>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={onSearchChange}
              style={styles.input}
            />
          </div>

          <div style={styles.mobileActions}>
            {isWorkerAccount ? (
              <button
                style={{ ...styles.primaryButton, backgroundColor: primaryActionTheme.base }}
                onClick={() => {
                  closeMenus();
                  onOpenMyWork && onOpenMyWork();
                }}
              >
                My Work
              </button>
            ) : (
              <button
                style={{ ...styles.primaryButton, backgroundColor: primaryActionTheme.base }}
                onClick={() => {
                  closeMenus();
                  onOpenSellerSetup && onOpenSellerSetup();
                }}
              >
                Become a Seller
              </button>
            )}
            <button style={styles.profileItem} onClick={() => { closeMenus(); onGoHome && onGoHome(); }}>Home</button>
            <button style={styles.profileItem} onClick={() => { closeMenus(); onOpenProfile && onOpenProfile(); }}>Profile</button>
            <button style={styles.profileItem} onClick={onOpenMyBookings}>My Bookings</button>
            <button style={styles.profileItem} onClick={() => { closeMenus(); onOpenProfile && onOpenProfile(); }}>Account Settings</button>
            <button style={styles.profileItem} onClick={() => { closeMenus(); onOpenSettings && onOpenSettings(); }}>Preferences</button>
            <button style={{ ...styles.profileItem, color: '#b91c1c' }} onClick={requestLogout}>
              Logout
            </button>
          </div>
        </div>
      )}

      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </header>
  );
}

export default Header;
