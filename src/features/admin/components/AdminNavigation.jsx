import React from 'react';
import PropTypes from 'prop-types';
import {
  ArrowLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Users,
  X,
} from 'lucide-react';
import { getThemeTokens } from '../../../shared/styles/themeTokens';
import BrandWordmark from '../../../shared/components/BrandWordmark';

function AdminNavigation({
  appTheme = 'light',
  activeSection = 'overview',
  onSectionChange,
  onOpenDashboard,
  onOpenLogoutConfirm,
  stats = {},
  isMobileOpen = false,
  onCloseMobile,
}) {
  const themeTokens = getThemeTokens(appTheme);

  const sections = [
    {
      key: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      key: 'accounts',
      label: 'Account Management',
      icon: Users,
      badge: stats.totalAccounts !== undefined && stats.totalAccounts !== null ? stats.totalAccounts : null,
    },
    {
      key: 'logs',
      label: 'Audit Logs',
      icon: ClipboardList,
      badge: stats.logsCount !== undefined && stats.logsCount !== null ? stats.logsCount : null,
    },
    {
      key: 'comments',
      label: 'Summary / Comments',
      icon: MessageSquare,
      badge: stats.flaggedComments > 0 ? stats.flaggedComments : null,
      badgeType: stats.flaggedComments > 0 ? 'warning' : 'default',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="gl-admin-sidebar-overlay"
          onClick={onCloseMobile}
          aria-label="Close navigation overlay"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && onCloseMobile && onCloseMobile()}
        />
      )}

      <aside
        className={`gl-admin-sidebar ${isMobileOpen ? 'open' : ''}`}
        aria-label="Admin Navigation Sidebar"
        style={{
          backgroundColor: themeTokens.surface,
          borderColor: themeTokens.border,
        }}
      >
        {/* Sidebar Header / Brand */}
        <div className="gl-admin-sidebar-header" style={{ borderColor: themeTokens.border }}>
          <button
            type="button"
            className="gl-admin-sidebar-brand"
            onClick={onOpenDashboard}
            aria-label="Back to App Home"
          >
            <img
              src="/trabawho-logo.svg"
              alt=""
              aria-hidden="true"
              className="gl-admin-brand-logo"
            />
            <div className="gl-admin-brand-info">
              <strong className="gl-admin-brand-title">
                <BrandWordmark />
              </strong>
              <span
                className="gl-admin-badge"
                style={{
                  backgroundColor: themeTokens.badgeBg,
                  color: themeTokens.badgeText,
                  borderColor: themeTokens.accent,
                }}
              >
                Admin
              </span>
            </div>
          </button>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              type="button"
              className="gl-admin-mobile-close"
              onClick={onCloseMobile}
              aria-label="Close navigation"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="gl-admin-sidebar-section-title" style={{ color: themeTokens.textMuted }}>
          <span>PORTAL MENU</span>
        </div>

        {/* Navigation List */}
        <nav className="gl-admin-nav-list" aria-label="Admin Sections">
          {sections.map(({ key, label, icon: Icon, badge, badgeType }) => {
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                type="button"
                className={`gl-admin-nav-item ${isActive ? 'active' : ''}`}
                style={
                  isActive
                    ? {
                        backgroundColor: themeTokens.accentSoft,
                        borderColor: themeTokens.accentBorder,
                        color: themeTokens.accent,
                      }
                    : {
                        color: themeTokens.textSecondary,
                      }
                }
                onClick={() => {
                  onSectionChange && onSectionChange(key);
                  onCloseMobile && onCloseMobile();
                }}
              >
                <Icon size={18} className="gl-admin-nav-icon" aria-hidden="true" />
                <span className="gl-admin-nav-label">{label}</span>
                {badge !== null && badge !== undefined && (
                  <span
                    className={`gl-admin-nav-badge ${badgeType === 'warning' ? 'badge-warning' : ''}`}
                    style={
                      badgeType === 'warning'
                        ? {
                            backgroundColor: themeTokens.dangerBg,
                            color: themeTokens.danger,
                            borderColor: themeTokens.dangerBorder,
                          }
                        : {
                            backgroundColor: themeTokens.surfaceSoft,
                            color: themeTokens.textSecondary,
                          }
                    }
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="gl-admin-sidebar-footer" style={{ borderColor: themeTokens.border }}>
          <button
            type="button"
            className="gl-admin-footer-btn gl-admin-back-btn"
            style={{
              backgroundColor: themeTokens.surfaceAlt,
              borderColor: themeTokens.border,
              color: themeTokens.textPrimary,
            }}
            onClick={onOpenDashboard}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to App</span>
          </button>

          <button
            type="button"
            className="gl-admin-footer-btn gl-admin-logout-btn"
            style={{
              backgroundColor: themeTokens.surfaceAlt,
              borderColor: themeTokens.border,
              color: themeTokens.danger,
            }}
            onClick={onOpenLogoutConfirm}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

AdminNavigation.propTypes = {
  appTheme: PropTypes.string,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
  onOpenDashboard: PropTypes.func,
  onOpenLogoutConfirm: PropTypes.func,
  stats: PropTypes.shape({
    totalAccounts: PropTypes.number,
    disabledAccounts: PropTypes.number,
    flaggedComments: PropTypes.number,
    logsCount: PropTypes.number,
  }),
  isMobileOpen: PropTypes.bool,
  onCloseMobile: PropTypes.func,
};

export default AdminNavigation;
