import AdminAnalytics from "../components/AdminAnalytics";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminIdentityReviews from "@/features/admin/identity/AdminIdentityReviews";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import LogoutConfirmModal from "@/features/auth/components/LogoutConfirmModal";
import AdminNavigation from "../components/AdminNavigation";
import AdminOverview from "../components/AdminOverview";
import AdminAccountsTable from "../components/AdminAccountsTable";
import AdminLogsSection from "../components/AdminLogsSection";
import AdminCommentsSection from "../components/AdminCommentsSection";
import { DeleteReviewConfirmation } from "../components/DeleteReviewConfirmation";
import AdminSettings from "../components/AdminSettings";
import AdminSupportCases from "../components/AdminSupportCases";
import { AdminCasePage } from "./AdminCasePage";
import { adminCasesPath, getAdminCaseId, paths } from "@/app/router/routes";
import AccessActionModal from "../components/AccessActionModal";
import { useAdminAccounts } from "../hooks/useAdminAccounts";
import type { AdminSection } from "../types";

interface Props { appTheme?: string; themeMode?: "light" | "dark" | "system"; onThemeChange?: (mode: "light" | "dark" | "system") => void; onLogout?: () => void; onOpenDashboard?: () => void; onOpenAccountSettings?: () => void; adminIdentity?: { fullName?: string; email?: string } | null }
const labels: Record<AdminSection, string> = { overview: "Overview", analytics: "Analytics", accounts: "Account management", identity: "Identity reviews", logs: "Audit logs", comments: "Reviews", cases: "Support cases", settings: "Settings" };

export default function AdminDashboard({ appTheme = "light", themeMode = "system", onThemeChange, onLogout, onOpenDashboard, onOpenAccountSettings, adminIdentity }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedSection, setSelectedSection] = useState<AdminSection>("overview");
  const caseId = getAdminCaseId(location.pathname);
  const activeSection = location.pathname === adminCasesPath || caseId ? "cases" : selectedSection;
  const setActiveSection = (section: AdminSection) => {
    setSelectedSection(section);
    if (section === "cases") void navigate(adminCasesPath);
    else if (location.pathname !== paths.admin) void navigate(paths.admin);
  };
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const state = useAdminAccounts();

  return <div className="min-h-screen w-full bg-background text-foreground" data-testid="admin-dashboard-page">
    <AdminNavigation activeSection={activeSection} onSectionChange={setActiveSection} onOpenDashboard={onOpenDashboard} onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)} totalAccounts={state.isAccountsLoading || state.accountsError ? undefined : state.accounts.length} adminIdentity={adminIdentity} isMobileOpen={isMobileNavOpen} onCloseMobile={() => setIsMobileNavOpen(false)} />
    <div className="min-w-0 min-[881px]:pl-[248px]"><header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6"><Button type="button" size="icon" variant="outline" className="min-[881px]:hidden" onClick={() => setIsMobileNavOpen(true)} aria-label="Open navigation menu"><Menu aria-hidden="true" /></Button><p className="min-w-0 truncate text-sm font-semibold"><span className="text-muted-foreground">Admin portal / </span>{labels[activeSection]}</p></header>
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {activeSection === "overview" && <AdminOverview stats={state.stats} totalAccounts={state.accounts.length} isLoading={state.isAccountsLoading} error={state.accountsError} onSectionChange={setActiveSection} />}
        {activeSection === "accounts" && <AdminAccountsTable accounts={state.normalizedAccounts} isLoading={state.isAccountsLoading} error={state.accountsError} onRetry={() => void state.refreshAccounts()} searchQuery={state.searchQuery} onSearchChange={state.setSearchQuery} selectedRole={state.selectedRole} onRoleFilterChange={state.setSelectedRole} roleSavingId={state.roleSavingId} accessSaving={state.accessSaving} onUpdateRole={(account, role) => void state.handleUpdateRole(account, role)} onOpenAccessAction={state.openAccessAction} onRestoreAccount={(account) => void state.handleRestoreAccount(account)} />}
        {activeSection === "analytics" && <AdminAnalytics />}
        {activeSection === "logs" && <AdminLogsSection />}
        {activeSection === "identity" && <AdminIdentityReviews />}
        {activeSection === "comments" && <AdminCommentsSection comments={state.comments} isLoading={state.isCommentsLoading} error={state.commentsError} total={state.reviewTotal} page={state.reviewPage} pageSize={state.reviewPageSize} search={state.reviewQuery} status={state.reviewStatus} rating={state.reviewRating} onSearchChange={state.setReviewQuery} onStatusChange={state.setReviewStatus} onRatingChange={state.setReviewRating} onPageChange={state.setReviewPage} onRetry={() => void state.refreshComments()} onOpenDeleteComment={state.setCommentDeleteTarget} />}
        {activeSection === "cases" && (caseId ? <AdminCasePage key={caseId} caseId={caseId} /> : <AdminSupportCases />)}
        {activeSection === "settings" && <AdminSettings appTheme={appTheme} identity={adminIdentity} onOpenAccountSettings={onOpenAccountSettings} onThemeChange={onThemeChange} themeMode={themeMode} />}
      </main>
    </div>
    <AccessActionModal isOpen={Boolean(state.accessActionTarget)} target={state.accessActionTarget} mode={state.accessActionMode} reason={state.accessReason} onReasonChange={state.setAccessReason} durationValue={state.accessDurationValue} onDurationValueChange={state.setAccessDurationValue} durationUnit={state.accessDurationUnit} onDurationUnitChange={state.setAccessDurationUnit} onConfirm={() => void state.handleConfirmAccessAction()} onCancel={state.closeAccessAction} isSaving={state.accessSaving} error={state.accessError} />
    <DeleteReviewConfirmation review={state.commentDeleteTarget} saving={state.commentSaving} error={state.commentActionError} onCancel={() => { state.setCommentDeleteTarget(null); state.setCommentActionError(""); }} onConfirm={(id) => { void state.handleDeleteComment(id); }} />
    <LogoutConfirmModal isOpen={isLogoutConfirmOpen} onCancel={() => setIsLogoutConfirmOpen(false)} onConfirm={() => { setIsLogoutConfirmOpen(false); onLogout?.(); }} />
  </div>;
}
