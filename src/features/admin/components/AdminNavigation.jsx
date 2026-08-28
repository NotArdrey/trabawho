import React from 'react';
import { getThemeTokens } from '../../../shared/styles/themeTokens';
import BrandWordmark from '../../../shared/components/BrandWordmark';

function AdminNavigation({ appTheme = 'light', activeSection = 'accounts', onSectionChange, onOpenDashboard, onOpenLogoutConfirm }) {
  const themeTokens = getThemeTokens(appTheme);

  const sections = [
    { key: 'overview', label: 'Overview', shortLabel: 'Overview' },
    { key: 'accounts', label: 'Account Management', shortLabel: 'Accounts' },
    { key: 'logs', label: 'Audit Logs', shortLabel: 'Logs' },
    { key: 'comments', label: 'Summary / Comments', shortLabel: 'Comments' },
  ];

  const styles = {
    nav: {
      position: 'sticky',
      top: 0,
      zIndex: 130,
      backgroundColor: themeTokens.navBg,
      borderBottom: `1px solid ${themeTokens.navBorder}`,
      boxShadow: themeTokens.shadowSoft,
    },
    inner: {
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '0.75rem 1rem',
      display: 'grid',
      gridTemplateColumns: 'minmax(170px, 1fr) minmax(320px, 1.2fr) minmax(180px, 1fr)',
      alignItems: 'center',
      gap: '0.75rem',
    },
    brandWrap: { display: 'flex', alignItems: 'center', gap: 'var(--gl-brand-gap)', minWidth: 0 },
    brandLogo: { width: 'var(--gl-brand-logo-size)', height: 'var(--gl-brand-logo-size)', objectFit: 'contain', flex: '0 0 auto' },
    brand: {
      margin: 0,
      fontFamily: "'Poppins', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 'var(--gl-brand-font-size)',
      fontWeight: 850,
      color: themeTokens.accent,
      lineHeight: 1,
      letterSpacing: 0,
      whiteSpace: 'nowrap',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '999px',
      padding: '4px 10px',
      fontSize: '12px',
      fontWeight: 800,
      backgroundColor: themeTokens.badgeBg,
      color: themeTokens.badgeText,
      whiteSpace: 'nowrap',
    },
    tabs: {
      display: 'flex',
      justifyContent: 'center',
      gap: '0.5rem',
      flexWrap: 'wrap',
    },
    tab: {
      border: `1px solid ${themeTokens.border}`,
      backgroundColor: themeTokens.surface,
      color: themeTokens.textPrimary,
      borderRadius: '999px',
      padding: '0.62rem 1rem',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    tabActive: {
      backgroundColor: themeTokens.accent,
      color: '#ffffff',
      borderColor: themeTokens.accent,
      boxShadow: themeTokens.accentShadow,
    },
    actions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem',
      flexWrap: 'wrap',
    },
    actionButton: {
      border: `1px solid ${themeTokens.border}`,
      backgroundColor: themeTokens.surface,
      color: themeTokens.textPrimary,
      borderRadius: '999px',
      padding: '0.6rem 0.95rem',
      fontWeight: 700,
      cursor: 'pointer',
    },
    actionPrimary: {
      backgroundColor: themeTokens.accent,
      color: '#ffffff',
      borderColor: themeTokens.accent,
    },
  };

  return (
    <nav className="gl-admin-nav" style={styles.nav}>
      <div className="gl-admin-nav-inner" style={styles.inner}>
        <div className="gl-admin-nav-brand" style={styles.brandWrap}>
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" style={styles.brandLogo} />
          <h1 style={styles.brand}><BrandWordmark /></h1>
          <span style={styles.badge}>Admin</span>
        </div>

        <div className="gl-admin-nav-tabs" style={styles.tabs}>
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              style={{ ...styles.tab, ...(activeSection === section.key ? styles.tabActive : {}) }}
              onClick={() => onSectionChange && onSectionChange(section.key)}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="gl-admin-nav-actions" style={styles.actions}>
          <button type="button" style={styles.actionButton} onClick={onOpenDashboard}>
            Back to App
          </button>
          <button type="button" style={{ ...styles.actionButton, ...styles.actionPrimary }} onClick={onOpenLogoutConfirm}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default AdminNavigation;
