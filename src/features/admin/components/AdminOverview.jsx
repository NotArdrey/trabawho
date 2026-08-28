/**
 * AdminOverview - View Component
 * 
 * Displays admin dashboard overview with stats and quick actions.
 * Pure presentation component - all logic handled by parent.
 */

import PropTypes from 'prop-types';

function AdminOverview({ stats, accounts, logs, themeTokens, styles }) {
  return (
    <>
      <section className="gl-admin-header-panel" style={styles.header}>
        <div style={styles.headerCopy}>
          <span style={styles.eyebrow}>Admin Portal UI</span>
          <h1 style={styles.title}>TrabaWho Admin Dashboard</h1>
          <p style={styles.subtitle}>
            Main landing view for admin summaries, trends, and quick status checks. Detailed management pages are available from the top navigation.
          </p>
        </div>
      </section>

      <section className="gl-admin-stats-grid" style={styles.statsGrid}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Total Accounts</p>
          <p style={styles.statValue}>{accounts.length}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Disabled Accounts</p>
          <p style={styles.statValue}>{stats.disabledAccounts}</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Flagged Comments</p>
          <p style={styles.statValue}>{stats.flaggedComments}</p>
        </div>
      </section>

      <section className="gl-admin-overview-grid" style={styles.overviewGrid}>
        <article style={styles.miniChartCard}>
          <div>
            <h2 style={styles.panelTitle}>Accounts Trend</h2>
            <p style={styles.panelDesc}>Recent account activity snapshot.</p>
          </div>
          <div style={styles.miniChartBars}>
            <div style={styles.miniBar('30%', themeTokens.accentSoft)} />
            <div style={styles.miniBar('48%', themeTokens.accentSoft)} />
            <div style={styles.miniBar('70%', themeTokens.accentBorder)} />
            <div style={styles.miniBar('54%', themeTokens.accent)} />
            <div style={styles.miniBar('82%', themeTokens.accentDeep)} />
          </div>
        </article>

        <article style={styles.miniChartCard}>
          <div>
            <h2 style={styles.panelTitle}>Content Health</h2>
            <p style={styles.panelDesc}>Quick moderation snapshot for comments and reports.</p>
          </div>
          <div style={styles.miniChartBars}>
            <div style={styles.miniBar('22%', themeTokens.successBg)} />
            <div style={styles.miniBar('46%', themeTokens.successBg)} />
            <div style={styles.miniBar('28%', themeTokens.successBorder)} />
            <div style={styles.miniBar('61%', themeTokens.success)} />
            <div style={styles.miniBar('36%', themeTokens.successText)} />
          </div>
        </article>

        <article style={styles.miniChartCard}>
          <div>
            <h2 style={styles.panelTitle}>Role Distribution</h2>
            <p style={styles.panelDesc}>Overview of clients, workers, and admins.</p>
          </div>
          <div style={styles.miniChartBars}>
            <div style={styles.miniBar('68%', '#e0e7ff')} />
            <div style={styles.miniBar('44%', '#c7d2fe')} />
            <div style={styles.miniBar('14%', '#818cf8')} />
          </div>
        </article>
      </section>

      <section className="gl-admin-summary-row" style={styles.summaryRow}>
        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitleWrap}>
              <h2 style={styles.panelTitle}>Top Summary</h2>
              <p style={styles.panelDesc}>A compact landing summary before opening each detailed page.</p>
            </div>
          </div>

          <div style={styles.summaryList}>
            <div style={styles.summaryItem}>
              <div>
                <p style={styles.summaryLabel}>Accounts Overview</p>
                <p style={styles.summaryValue}>Manage client, worker, and admin users</p>
              </div>
              <span style={{ ...styles.badge, ...styles.badgeAdmin }}>{accounts.length}</span>
            </div>
            <div style={styles.summaryItem}>
              <div>
                <p style={styles.summaryLabel}>Audit Logs</p>
                <p style={styles.summaryValue}>Recent actions, alerts, and system events</p>
              </div>
              <span style={{ ...styles.badge, ...styles.badgeActive }}>{logs.length}</span>
            </div>
            <div style={styles.summaryItem}>
              <div>
                <p style={styles.summaryLabel}>Comment Moderation</p>
                <p style={styles.summaryValue}>Review flagged feedback and remove spam</p>
              </div>
              <span style={{ ...styles.badge, ...styles.badgeDisabled }}>{stats.flaggedComments}</span>
            </div>
          </div>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitleWrap}>
              <h2 style={styles.panelTitle}>Quick Actions</h2>
              <p style={styles.panelDesc}>Navigate into any section from here.</p>
            </div>
          </div>

          <div style={styles.activityList}>
            <div style={styles.activityItem}>
              <p style={styles.activityTitle}>Review Accounts</p>
              <p style={styles.activityMeta}>Open account management to disable or enable users.</p>
            </div>
            <div style={styles.activityItem}>
              <p style={styles.activityTitle}>Check Logs</p>
              <p style={styles.activityMeta}>View system activity and moderation history.</p>
            </div>
            <div style={styles.activityItem}>
              <p style={styles.activityTitle}>Moderate Comments</p>
              <p style={styles.activityMeta}>Handle spam, abuse, and review entries.</p>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

AdminOverview.propTypes = {
  stats: PropTypes.shape({
    activeAccounts: PropTypes.number,
    disabledAccounts: PropTypes.number,
    suspendedAccounts: PropTypes.number,
    flaggedComments: PropTypes.number,
  }).isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  logs: PropTypes.arrayOf(PropTypes.object).isRequired,
  themeTokens: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
};

export default AdminOverview;
