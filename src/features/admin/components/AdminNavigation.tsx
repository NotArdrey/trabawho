import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminNavigationItem, AdminSectionKey } from "@/features/admin/types";
import BrandWordmark from "@/shared/components/BrandWordmark";

interface AdminNavigationProps {
  activeSection: AdminSectionKey;
  onSectionChange: (section: AdminSectionKey) => void;
  onOpenDashboard?: () => void;
  onOpenLogoutConfirm: () => void;
  stats: {
    totalAccounts: number;
    flaggedComments: number;
  };
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavigationGroup {
  label: string;
  items: AdminNavigationItem[];
}

export default function AdminNavigation({
  activeSection,
  onSectionChange,
  onOpenDashboard,
  onOpenLogoutConfirm,
  stats,
  isMobileOpen,
  onCloseMobile,
}: AdminNavigationProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileOpen) return undefined;

    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMobileOpen, onCloseMobile]);

  const groups: NavigationGroup[] = [
    {
      label: "Overview",
      items: [{ key: "overview", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "Management",
      items: [
        { key: "users", label: "Users", icon: Users, badge: stats.totalAccounts },
        { key: "jobs", label: "Jobs", icon: BriefcaseBusiness },
        { key: "employers", label: "Employers", icon: Building2 },
        { key: "applications", label: "Applications", icon: ClipboardCheck },
      ],
    },
    {
      label: "Trust & safety",
      items: [
        {
          key: "moderation",
          label: "Moderation",
          icon: ShieldCheck,
          badge: stats.flaggedComments || undefined,
          badgeTone: stats.flaggedComments > 0 ? "warning" : "default",
        },
        { key: "audit-logs", label: "Audit logs", icon: FileClock },
      ],
    },
    {
      label: "System",
      items: [{ key: "settings", label: "Settings", icon: Settings }],
    },
  ];

  const openSection = (section: AdminSectionKey) => {
    onSectionChange(section);
    onCloseMobile();
  };

  return (
    <>
      {isMobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-slate-950/55 lg:hidden"
          aria-label="Close admin navigation"
          tabIndex={-1}
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card text-card-foreground transition-transform duration-200 lg:visible lg:pointer-events-auto lg:translate-x-0 ${
          isMobileOpen ? "visible translate-x-0 shadow-xl" : "invisible pointer-events-none -translate-x-full"
        }`}
        aria-label="Admin navigation sidebar"
      >
        <div className="flex min-h-20 items-center gap-3 border-b border-border px-5">
          <button
            type="button"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => openSection("overview")}
            aria-label="Open admin dashboard"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BriefcaseBusiness className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <BrandWordmark className="text-lg" />
              <span className="block text-xs font-medium text-muted-foreground">Admin operations</span>
            </span>
          </button>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close admin navigation"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin sections">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ key, label, icon: Icon, badge, badgeTone }) => {
                  const isActive = activeSection === key;
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="ghost"
                      className={`w-full justify-start px-3 ${
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                          : "text-muted-foreground"
                      }`}
                      aria-label={badge !== undefined ? `${label}: ${badge}` : label}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => openSection(key)}
                    >
                      <Icon aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-left">{label}</span>
                      {badge !== undefined ? (
                        <Badge variant={badgeTone === "warning" ? "warning" : "secondary"} aria-hidden="true">
                          {badge}
                        </Badge>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          {onOpenDashboard ? (
            <Button type="button" variant="outline" className="w-full justify-start" onClick={onOpenDashboard}>
              <ArrowLeft aria-hidden="true" />
              Back to TrabaWho
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onOpenLogoutConfirm}
          >
            <LogOut aria-hidden="true" />
            Log out
          </Button>
        </div>
      </aside>
    </>
  );
}
