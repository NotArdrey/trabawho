import { ArrowLeft, ClipboardList, Inbox, LayoutDashboard, LogOut, MessageSquare, Settings2, Shield, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { desktopWorkspaceSidebarClass, WorkspaceSidebarAccount, WorkspaceSidebarBrand, WorkspaceSidebarIdentity, WorkspaceSidebarNavItem } from "@/shared/components/WorkspaceSidebar";
import type { AdminSection } from "../types";

interface Props {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onOpenDashboard?: () => void;
  onOpenLogoutConfirm: () => void;
  totalAccounts?: number;
  adminIdentity?: { fullName?: string; email?: string } | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const sections = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "accounts", label: "Account Management", icon: Users },
  { key: "logs", label: "Audit Logs", icon: ClipboardList },
  { key: "comments", label: "Reviews", icon: MessageSquare },
  { key: "cases", label: "Support cases", icon: Inbox },
] as const;

function NavigationContent({ activeSection, onSectionChange, onOpenDashboard, onOpenLogoutConfirm, totalAccounts, adminIdentity, onCloseMobile }: Omit<Props, "isMobileOpen">) {
  const openSection = (section: AdminSection) => { onSectionChange(section); onCloseMobile(); };
  return <div data-testid="admin-sidebar-content" className="flex h-full min-h-0 min-w-0 w-full flex-col gap-[18px] overflow-y-auto px-3.5 pb-3.5 pt-[18px]">
    <WorkspaceSidebarBrand onClick={() => openSection("overview")} />
    <WorkspaceSidebarIdentity label="Admin workspace" description="Manage platform operations" icon={Shield} onClick={() => openSection("overview")} actionLabel="Open admin overview" />
    <section className="grid min-w-0 content-start gap-2" aria-labelledby="admin-workspace-navigation-label">
      <p id="admin-workspace-navigation-label" className="px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Workspace</p>
      <nav aria-label="Admin Sections" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
        {sections.map(({ key, label, icon }) => <WorkspaceSidebarNavItem key={key} label={label} icon={icon} active={activeSection === key} onClick={() => openSection(key)} trailing={key === "accounts" && totalAccounts !== undefined ? <Badge variant="secondary">{totalAccounts}</Badge> : undefined} />)}
      </nav>
    </section>
    <div className="mt-auto grid min-w-0 gap-2.5 border-t pt-3">
      <div className="grid gap-1" aria-label="Account shortcuts">
        <Button type="button" variant="ghost" aria-current={activeSection === "settings" ? "page" : undefined} className={cn("justify-start px-2.5 text-muted-foreground", activeSection === "settings" && "bg-accent text-foreground")} onClick={() => openSection("settings")}><Settings2 aria-hidden="true" />Settings</Button>
        <Button type="button" variant="ghost" className="justify-start px-2.5 text-muted-foreground" onClick={onOpenDashboard}><ArrowLeft aria-hidden="true" />Back to App</Button>
      </div>
      <WorkspaceSidebarAccount name={adminIdentity?.fullName || "TrabaWho admin"} subtitle={adminIdentity?.email || "Admin workspace"} onClick={() => openSection("settings")} actionLabel="Open admin settings" />
      <Button type="button" variant="outline" className="w-full justify-start border-destructive/30 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onOpenLogoutConfirm}><LogOut aria-hidden="true" />Logout</Button>
    </div>
  </div>;
}

export default function AdminNavigation(props: Props) {
  return <>
    <aside className={cn(desktopWorkspaceSidebarClass, "!p-0")} aria-label="Admin Navigation Sidebar"><NavigationContent {...props} /></aside>
    <Dialog open={props.isMobileOpen} onOpenChange={(open) => { if (!open) props.onCloseMobile(); }}>
      <DialogContent aria-label="Admin navigation" className="!bottom-0 !left-0 !top-0 !max-h-screen !w-[248px] !max-w-[85vw] !translate-x-0 !translate-y-0 !rounded-none !p-0 min-[881px]:hidden">
        <DialogTitle className="sr-only">Admin navigation</DialogTitle>
        <NavigationContent {...props} />
      </DialogContent>
    </Dialog>
  </>;
}
