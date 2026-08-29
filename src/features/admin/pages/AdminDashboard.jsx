import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  LogOut,
  Menu,
} from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';
import AdminOverview from '../components/AdminOverview';
import AdminAccountsTable from '../components/AdminAccountsTable';
import AdminLogsSection from '../components/AdminLogsSection';
import AdminCommentsSection from '../components/AdminCommentsSection';
import AccessActionModal from '../components/AccessActionModal';
import LogoutConfirmModal from '../../auth/components/LogoutConfirmModal';
import { ConfirmActionModal } from '../../../shared/components';
import { getThemeTokens } from '../../../shared/styles/themeTokens';
import { useAdminAccounts } from '../hooks/useAdminAccounts';

function AdminDashboard({ appTheme = 'light', onLogout, onOpenDashboard }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Controller hook - handles all business logic and state
  const adminState = useAdminAccounts();

  // Periodic refresh while on accounts section
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (activeSection !== 'accounts') return;
      // Could trigger a refetch here if added to the hook
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [activeSection]);

  const themeTokens = getThemeTokens(appTheme);

  const handleOpenLogoutConfirm = () => setIsLogoutConfirmOpen(true);

  const handleCloseLogoutConfirm = () => setIsLogoutConfirmOpen(false);

  const handleConfirmLogout = () => {
    setIsLogoutConfirmOpen(false);
    onLogout && onLogout();
  };

  const sectionLabels = {
    overview: 'Overview & Metrics',
    accounts: 'Account Management',
    logs: 'Audit Logs',
    comments: 'Summary / Comments Moderation',
  };

  // Styles object - all styling in one place
  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: themeTokens.pageBg,
      color: themeTokens.textPrimary,
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      display: 'flex',
      width: '100%',
      position: 'relative',
    },
    mainWrapper: {
      flex: '1 1 auto',
      marginLeft: '256px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      width: 'calc(100% - 256px)',
    },
    topbar: {
      position: 'sticky',
      top: 0,
      zIndex: 120,
      minHeight: '62px',
      backgroundColor: themeTokens.surface,
      borderBottom: `1px solid ${themeTokens.border}`,
      boxShadow: themeTokens.shadowSoft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      gap: '16px',
    },
    topbarLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      minWidth: 0,
    },
    topbarMobileToggle: {
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '8px',
      backgroundColor: themeTokens.surfaceAlt,
      color: themeTokens.textPrimary,
      padding: '7px',
      cursor: 'pointer',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
    },
    topbarBreadcrumb: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    topbarParent: {
      color: themeTokens.textMuted,
    },
    topbarSlash: {
      color: themeTokens.border,
    },
    topbarCurrent: {
      color: themeTokens.textPrimary,
      fontWeight: 800,
    },
    topbarRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexShrink: 0,
    },
    topbarStatusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '999px',
      backgroundColor: themeTokens.successBg,
      border: `1px solid ${themeTokens.successBorder}`,
      fontSize: '12px',
      fontWeight: 750,
      color: themeTokens.successText,
    },
    topbarStatusDot: {
      width: '7px',
      height: '7px',
      borderRadius: '999px',
      backgroundColor: themeTokens.success,
    },
    topbarActionBtn: {
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '8px',
      backgroundColor: themeTokens.surfaceAlt,
      color: themeTokens.textPrimary,
      padding: '7px 12px',
      fontSize: '13px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    },
    topbarLogoutBtn: {
      backgroundColor: themeTokens.dangerBg,
      color: themeTokens.danger,
      borderColor: themeTokens.dangerBorder,
    },
    shell: {
      maxWidth: '1360px',
      width: '100%',
      margin: '0 auto',
      padding: '24px',
      boxSizing: 'border-box',
    },
    header: {
      backgroundColor: themeTokens.surface,
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '16px',
      boxShadow: themeTokens.shadowSoft,
      padding: '18px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    },
    headerCopy: { display: 'grid', gap: '6px' },
    eyebrow: {
      display: 'inline-flex',
      width: 'fit-content',
      borderRadius: '999px',
      padding: '4px 10px',
      fontSize: '12px',
      fontWeight: 800,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      backgroundColor: themeTokens.badgeBg,
      color: themeTokens.badgeText,
    },
    title: { margin: 0, fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.15 },
    subtitle: { margin: 0, color: themeTokens.textSecondary, lineHeight: 1.5, maxWidth: '780px' },
    headerActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    actionButton: {
      border: 'none',
      borderRadius: '10px',
      padding: '10px 14px',
      fontWeight: 700,
      cursor: 'pointer',
      backgroundColor: themeTokens.accent,
      color: '#ffffff',
    },
    actionSecondary: {
      border: `1px solid ${themeTokens.border}`,
      backgroundColor: themeTokens.surfaceAlt,
      color: themeTokens.textPrimary,
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '14px',
      marginTop: '16px',
    },
    statCard: {
      backgroundColor: themeTokens.surface,
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '14px',
      padding: '16px',
      boxShadow: themeTokens.shadowSoft,
    },
    statLabel: { margin: 0, color: themeTokens.textSecondary, fontSize: '0.9rem', fontWeight: 600 },
    statValue: { margin: '6px 0 0', fontSize: '1.65rem', fontWeight: 800 },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: '1.1fr 0.9fr',
      gap: '16px',
      marginTop: '16px',
    },
    panel: {
      backgroundColor: themeTokens.surface,
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '16px',
      boxShadow: themeTokens.shadowSoft,
      padding: '16px',
      minWidth: 0,
    },
    panelHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      marginBottom: '14px',
      flexWrap: 'wrap',
    },
    panelTitleWrap: { display: 'grid', gap: '4px' },
    panelTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 800 },
    panelDesc: { margin: 0, color: themeTokens.textSecondary, fontSize: '0.92rem', lineHeight: 1.45 },
    filterBar: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
    searchInput: {
      minWidth: '220px',
      height: '42px',
      borderRadius: '10px',
      border: `1px solid ${themeTokens.inputBorder}`,
      backgroundColor: themeTokens.inputBg,
      color: themeTokens.inputText,
      padding: '0 12px',
      outline: 'none',
    },
    select: {
      height: '42px',
      borderRadius: '10px',
      border: `1px solid ${themeTokens.inputBorder}`,
      backgroundColor: themeTokens.inputBg,
      color: themeTokens.inputText,
      padding: '0 12px',
      outline: 'none',
    },
    tableWrap: { overflowX: 'auto', borderRadius: '12px', border: `1px solid ${themeTokens.border}` },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '720px', backgroundColor: themeTokens.surface },
    th: {
      textAlign: 'left',
      padding: '12px 14px',
      fontSize: '0.8rem',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: themeTokens.textSecondary,
      backgroundColor: themeTokens.surfaceAlt,
      borderBottom: `1px solid ${themeTokens.border}`,
    },
    td: { padding: '12px 14px', borderBottom: `1px solid ${themeTokens.border}`, verticalAlign: 'middle' },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 800,
      textTransform: 'capitalize',
    },
    badgeActive: { backgroundColor: themeTokens.successBg, color: themeTokens.successText, border: `1px solid ${themeTokens.successBorder}` },
    badgeDisabled: { backgroundColor: themeTokens.dangerBg, color: themeTokens.danger, border: `1px solid ${themeTokens.dangerBorder}` },
    badgeAdmin: { backgroundColor: themeTokens.badgeBg, color: themeTokens.badgeText, border: `1px solid ${themeTokens.accent}` },
    rowActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    rowButton: {
      border: 'none',
      borderRadius: '8px',
      padding: '8px 10px',
      fontWeight: 700,
      cursor: 'pointer',
      backgroundColor: themeTokens.accent,
      color: '#ffffff',
      fontSize: '12px',
    },
    rowButtonMuted: {
      backgroundColor: themeTokens.surfaceSoft,
      color: themeTokens.textPrimary,
      border: `1px solid ${themeTokens.border}`,
    },
    activityList: { display: 'grid', gap: '10px' },
    activityItem: {
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '12px',
      padding: '12px',
      backgroundColor: themeTokens.surfaceAlt,
      display: 'grid',
      gap: '6px',
    },
    activityTop: { display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
    activityMeta: { margin: 0, color: themeTokens.textSecondary, fontSize: '0.9rem' },
    activityTitle: { margin: 0, fontWeight: 800 },
    severity: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '999px',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      width: 'fit-content',
    },
    severityLow: { backgroundColor: themeTokens.successBg, color: themeTokens.successText },
    severityMedium: { backgroundColor: themeTokens.warningBg, color: themeTokens.warning },
    severityHigh: { backgroundColor: themeTokens.dangerBg, color: themeTokens.danger },
    commentList: { display: 'grid', gap: '12px' },
    commentCard: {
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '12px',
      padding: '12px',
      backgroundColor: themeTokens.surfaceAlt,
      display: 'grid',
      gap: '8px',
    },
    commentHeader: { display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' },
    commentMeta: { margin: 0, color: themeTokens.textSecondary, fontSize: '0.9rem' },
    commentText: { margin: 0, color: themeTokens.textPrimary, lineHeight: 1.5 },
    commentActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    emptyState: {
      padding: '18px',
      borderRadius: '12px',
      border: `1px dashed ${themeTokens.border}`,
      color: themeTokens.textSecondary,
      backgroundColor: themeTokens.surfaceAlt,
    },
    sectionNavHint: {
      marginTop: '14px',
      color: themeTokens.textSecondary,
      fontSize: '0.92rem',
    },
    overviewGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '16px',
      marginTop: '16px',
    },
    miniChartCard: {
      backgroundColor: themeTokens.surface,
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '14px',
      padding: '16px',
      boxShadow: themeTokens.shadowSoft,
      display: 'grid',
      gap: '10px',
      minHeight: '190px',
    },
    miniChartBars: {
      display: 'flex',
      alignItems: 'end',
      gap: '10px',
      minHeight: '110px',
      paddingTop: '8px',
    },
    miniBar: (height, color) => ({
      width: '100%',
      height,
      borderRadius: '12px 12px 4px 4px',
      background: color,
      boxShadow: themeTokens.accentShadow,
    }),
    summaryRow: {
      display: 'grid',
      gridTemplateColumns: '1.1fr 0.9fr',
      gap: '16px',
      marginTop: '16px',
    },
    summaryList: { display: 'grid', gap: '10px' },
    summaryItem: {
      border: `1px solid ${themeTokens.border}`,
      borderRadius: '12px',
      padding: '12px',
      backgroundColor: themeTokens.surfaceAlt,
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      alignItems: 'center',
    },
    summaryLabel: { margin: 0, color: themeTokens.textSecondary, fontSize: '0.9rem' },
    summaryValue: { margin: 0, fontWeight: 800, fontSize: '1.05rem' },
  };

  return (
    <div className="gl-admin-layout gl-admin-page" data-testid="admin-dashboard-page" style={styles.page}>
      <AdminNavigation
        appTheme={appTheme}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onOpenDashboard={onOpenDashboard}
        onOpenLogoutConfirm={handleOpenLogoutConfirm}
        stats={{
          totalAccounts: adminState.accounts?.length || 0,
          disabledAccounts: adminState.stats?.disabledAccounts || 0,
          flaggedComments: adminState.stats?.flaggedComments || 0,
          logsCount: adminState.logs?.length || 0,
        }}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="gl-admin-main-wrapper" style={styles.mainWrapper}>
        {/* Top Header / Topbar */}
        <header className="gl-admin-topbar" style={styles.topbar}>
          <div style={styles.topbarLeft}>
            <button
              type="button"
              className="gl-admin-mobile-toggle"
              style={styles.topbarMobileToggle}
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div style={styles.topbarBreadcrumb}>
              <span style={styles.topbarParent}>Admin Portal</span>
              <span style={styles.topbarSlash}>/</span>
              <span style={styles.topbarCurrent}>{sectionLabels[activeSection] || 'Dashboard'}</span>
            </div>
          </div>

          <div style={styles.topbarRight}>
            <div style={styles.topbarStatusBadge}>
              <span style={styles.topbarStatusDot} />
              <span>Admin Live</span>
            </div>
            <button
              type="button"
              className="gl-admin-topbar-action-btn"
              style={styles.topbarActionBtn}
              onClick={onOpenDashboard}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Back to App</span>
            </button>
            <button
              type="button"
              className="gl-admin-topbar-action-btn gl-admin-topbar-logout-btn"
              style={{ ...styles.topbarActionBtn, ...styles.topbarLogoutBtn }}
              onClick={handleOpenLogoutConfirm}
            >
              <LogOut size={15} aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Content Shell */}
        <main className="gl-admin-shell" style={styles.shell}>
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <AdminOverview
              stats={adminState.stats}
              accounts={adminState.accounts}
              logs={adminState.logs}
              themeTokens={themeTokens}
              styles={styles}
              onSectionChange={setActiveSection}
            />
          )}

          {/* Accounts Management Section */}
          {activeSection === 'accounts' && (
            <AdminAccountsTable
              normalizedAccounts={adminState.normalizedAccounts}
              isAccountsLoading={adminState.isAccountsLoading}
              accountsError={adminState.accountsError}
              searchQuery={adminState.searchQuery}
              onSearchChange={adminState.setSearchQuery}
              selectedRole={adminState.selectedRole}
              onRoleFilterChange={adminState.setSelectedRole}
              roleSavingId={adminState.roleSavingId}
              onUpdateRole={adminState.handleUpdateRole}
              onOpenAccessAction={adminState.openAccessAction}
              onRestoreAccount={adminState.handleRestoreAccount}
              themeTokens={themeTokens}
              styles={styles}
            />
          )}

          {/* Audit Logs Section */}
          {activeSection === 'logs' && (
            <AdminLogsSection
              logs={adminState.logs}
              styles={styles}
            />
          )}

          {/* Comments Moderation Section */}
          {activeSection === 'comments' && (
            <AdminCommentsSection
              comments={adminState.comments}
              commentsError={adminState.commentsError}
              onOpenDeleteComment={adminState.setCommentDeleteTarget}
              styles={styles}
            />
          )}

          {activeSection !== 'overview' && (
            <p style={styles.sectionNavHint}>
              Use the sidebar navigation to switch between admin sections.
            </p>
          )}
        </main>
      </div>

      {/* Access Action Modal (Disable/Ban) */}
      <AccessActionModal
        isOpen={Boolean(adminState.accessActionTarget)}
        target={adminState.accessActionTarget}
        mode={adminState.accessActionMode}
        reason={adminState.accessReason}
        onReasonChange={adminState.setAccessReason}
        durationValue={adminState.accessDurationValue}
        onDurationValueChange={adminState.setAccessDurationValue}
        durationUnit={adminState.accessDurationUnit}
        onDurationUnitChange={adminState.setAccessDurationUnit}
        onConfirm={adminState.handleConfirmAccessAction}
        onCancel={adminState.closeAccessAction}
        themeTokens={themeTokens}
        styles={styles}
      />

      {/* Comment Delete Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(adminState.commentDeleteTarget)}
        appTheme={appTheme}
        title="Delete Comment"
        description="This moderation action removes the selected review comment from the database."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => adminState.setCommentDeleteTarget(null)}
        onConfirm={() => adminState.handleDeleteComment(adminState.commentDeleteTarget?.id)}
      >
        <p style={{ margin: 0, color: themeTokens.textPrimary }}>
          Delete <strong>{adminState.commentDeleteTarget?.comment}</strong> from <strong>{adminState.commentDeleteTarget?.worker}</strong>?
        </p>
      </ConfirmActionModal>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onCancel={handleCloseLogoutConfirm}
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}

export default AdminDashboard;
