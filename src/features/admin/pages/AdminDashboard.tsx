import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { paths } from "@/app/router/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AccessActionModal from "@/features/admin/components/AccessActionModal";
import AdminAccountsTable from "@/features/admin/components/AdminAccountsTable";
import AdminCommentsSection from "@/features/admin/components/AdminCommentsSection";
import AdminLogsSection from "@/features/admin/components/AdminLogsSection";
import AdminNavigation from "@/features/admin/components/AdminNavigation";
import AdminOverview from "@/features/admin/components/AdminOverview";
import AdminIdentityReviewQueue from "@/features/admin/components/AdminIdentityReviewQueue";
import AdminSectionPlaceholder from "@/features/admin/components/AdminSectionPlaceholder";
import { useAdminAccounts } from "@/features/admin/hooks/useAdminAccounts";
import type { AdminSectionKey, AdminState } from "@/features/admin/types";
import LogoutConfirmModal from "@/features/auth/components/LogoutConfirmModal";
import { ConfirmActionModal } from "@/shared/components";

interface AdminDashboardProps {
  appTheme?: "light" | "dark";
  onLogout?: () => void;
  onOpenDashboard?: () => void;
}

const sectionPaths: Record<AdminSectionKey, string> = {
  overview: paths.admin,
  users: paths.adminUsers,
  jobs: paths.adminJobs,
  employers: paths.adminEmployers,
  applications: paths.adminApplications,
  moderation: paths.adminModeration,
  "audit-logs": paths.adminAuditLogs,
  settings: paths.adminSettings,
};

const sectionLabels: Record<AdminSectionKey, string> = {
  overview: "Dashboard",
  users: "User management",
  jobs: "Job management",
  employers: "Employer management",
  applications: "Application monitoring",
  moderation: "Trust & safety",
  "audit-logs": "Audit logs",
  settings: "Settings",
};

const placeholderSections = {
  jobs: {
    icon: BriefcaseBusiness,
    title: "Job management",
    description: "Review the job lifecycle from submission through removal without mixing moderation into the dashboard.",
    scope: ["All jobs", "Pending jobs", "Active jobs", "Flagged jobs", "Removed jobs"],
  },
  employers: {
    icon: Building2,
    title: "Employer management",
    description: "Keep company records, verification decisions, and employer access reviews in one focused workspace.",
    scope: ["Companies", "Verification queue", "Suspended employers", "Decision history"],
  },
  applications: {
    icon: ClipboardCheck,
    title: "Application monitoring",
    description: "Monitor application activity and investigate workflow issues without changing candidate decisions.",
    scope: ["Application activity", "Status monitoring", "Failed operations", "Escalations"],
  },
  settings: {
    icon: Settings,
    title: "Admin settings",
    description: "Manage platform-level administrative configuration behind explicit permissions and audit coverage.",
    scope: ["Role permissions", "Moderation policy", "Notification rules", "Platform configuration"],
  },
} as const;

const sectionFromPathname = (pathname: string): AdminSectionKey => {
  const match = Object.entries(sectionPaths).find(([, path]) => path === pathname);
  return (match?.[0] as AdminSectionKey | undefined) ?? "overview";
};

export default function AdminDashboard({ onLogout, onOpenDashboard }: AdminDashboardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const adminState = useAdminAccounts() as AdminState;
  const activeSection = sectionFromPathname(location.pathname);

  const closeMobileNavigation = () => {
    const shouldRestoreFocus = isMobileNavOpen;
    setIsMobileNavOpen(false);
    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

  const openSection = (section: AdminSectionKey) => {
    void navigate(sectionPaths[section]);
  };

  const confirmLogout = () => {
    setIsLogoutConfirmOpen(false);
    onLogout?.();
  };

  const placeholder = activeSection in placeholderSections
    ? placeholderSections[activeSection as keyof typeof placeholderSections]
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="admin-dashboard-page">
      <a
        href="#admin-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:translate-y-0"
      >
        Skip to admin content
      </a>

      <AdminNavigation
        activeSection={activeSection}
        onSectionChange={openSection}
        onOpenDashboard={onOpenDashboard}
        onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
        stats={{
          totalAccounts: adminState.accounts.length,
          flaggedComments: adminState.stats.flaggedComments,
        }}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={closeMobileNavigation}
      />

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              ref={menuButtonRef}
              type="button"
              size="icon"
              variant="outline"
              className="lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open admin navigation"
              aria-expanded={isMobileNavOpen}
            >
              <Menu aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Admin portal</p>
              <h1 className="truncate text-base font-semibold sm:text-lg">{sectionLabels[activeSection]}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
              Admin access
            </Badge>
            {onOpenDashboard ? (
              <Button type="button" variant="outline" className="hidden xl:inline-flex" onClick={onOpenDashboard}>
                <ArrowLeft aria-hidden="true" />
                Back to TrabaWho
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setIsLogoutConfirmOpen(true)}
              aria-label="Log out"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </header>

        <main id="admin-content" className="mx-auto w-full max-w-[96rem] p-4 sm:p-6 lg:p-8">
          {activeSection === "overview" ? (
            <AdminOverview
              stats={adminState.stats}
              accounts={adminState.accounts}
              comments={adminState.comments}
              logs={adminState.logs}
              isAccountsLoading={adminState.isAccountsLoading}
              accountsError={adminState.accountsError}
              commentsError={adminState.commentsError}
              onSectionChange={openSection}
            />
          ) : null}

          {activeSection === "users" ? (
            <div className="grid gap-6">
              <AdminIdentityReviewQueue />
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
              />
            </div>
          ) : null}

          {activeSection === "moderation" ? (
            <AdminCommentsSection
              comments={adminState.comments}
              commentsError={adminState.commentsError}
              onOpenDeleteComment={adminState.setCommentDeleteTarget}
            />
          ) : null}

          {activeSection === "audit-logs" ? <AdminLogsSection logs={adminState.logs} /> : null}

          {placeholder ? (
            <AdminSectionPlaceholder
              icon={placeholder.icon}
              title={placeholder.title}
              description={placeholder.description}
              scope={placeholder.scope}
            />
          ) : null}
        </main>
      </div>

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
      />

      <ConfirmActionModal
        isOpen={Boolean(adminState.commentDeleteTarget)}
        title="Delete review comment"
        description="This moderation action permanently removes the selected review comment."
        confirmLabel="Delete comment"
        cancelLabel="Cancel"
        onCancel={() => adminState.setCommentDeleteTarget(null)}
        onConfirm={() => { void adminState.handleDeleteComment(adminState.commentDeleteTarget?.id); }}
      >
        <p className="m-0 text-foreground">
          Delete “<strong>{adminState.commentDeleteTarget?.comment}</strong>” from the review for{" "}
          <strong>{adminState.commentDeleteTarget?.worker}</strong>?
        </p>
      </ConfirmActionModal>

      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
