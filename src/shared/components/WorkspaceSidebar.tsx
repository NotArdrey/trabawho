import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import BrandWordmark from "./BrandWordmark";

type SidebarIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export const desktopWorkspaceSidebarClass = "fixed inset-y-0 left-0 z-[140] hidden w-[248px] flex-col gap-[18px] overflow-y-auto border-r bg-background/95 px-3.5 pb-3.5 pt-[18px] shadow-[10px_0_30px_rgba(15,23,42,0.04)] backdrop-blur min-[881px]:flex";
export const workspaceSidebarNavClass = "group relative flex min-h-12 min-w-0 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WorkspaceSidebarBrand({ onClick }: { onClick: () => void }) {
  return <button type="button" className="flex min-h-[54px] w-full items-center gap-2.5 rounded-lg px-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick} aria-label="Open home">
    <img className="size-10 shrink-0 object-contain" src="/trabawho-logo.svg" alt="" aria-hidden="true" />
    <span className="min-w-0"><BrandWordmark className="block text-xl leading-none" /><small className="mt-1 block truncate text-[10px] font-semibold text-muted-foreground">Local services marketplace</small></span>
  </button>;
}

export function WorkspaceSidebarIdentity({ label, description, icon: Icon, actionIcon: ActionIcon = ChevronRight, onClick, actionLabel }: {
  label: string;
  description: string;
  icon: SidebarIcon;
  actionIcon?: SidebarIcon;
  onClick: () => void;
  actionLabel?: string;
}) {
  return <button type="button" className="grid min-h-[72px] w-full grid-cols-[38px_minmax(0,1fr)_18px] items-center gap-2.5 rounded-lg bg-primary/10 p-2.5 text-left text-foreground hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick} aria-label={actionLabel || label}>
    <span className="flex size-[38px] items-center justify-center rounded-lg bg-primary text-primary-foreground"><Icon className="size-[18px]" aria-hidden /></span>
    <span className="min-w-0"><strong className="block text-[13px] leading-tight">{label}</strong><small className="mt-1 block truncate text-[10px] text-muted-foreground">{description}</small></span>
    <ActionIcon className="size-4 text-primary" aria-hidden />
  </button>;
}

export function WorkspaceSidebarNavItem({ label, icon: Icon, active, onClick, trailing }: {
  label: string;
  icon: SidebarIcon;
  active: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return <button type="button" className={cn(workspaceSidebarNavClass, active && "bg-primary/10 text-primary")} aria-current={active ? "page" : undefined} onClick={onClick}>
    <span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r bg-transparent", active && "bg-primary")} aria-hidden="true" />
    <Icon className={cn("size-8 shrink-0 rounded-lg bg-muted p-2", active && "bg-primary text-primary-foreground")} aria-hidden />
    <span className="min-w-0 flex-1 truncate">{label}</span>{trailing && <span className="shrink-0">{trailing}</span>}
  </button>;
}

export function WorkspaceSidebarAccount({ name, subtitle, imageUrl, active = false, onClick, actionLabel }: {
  name: string;
  subtitle: string;
  imageUrl?: string;
  active?: boolean;
  onClick: () => void;
  actionLabel: string;
}) {
  return <button type="button" className={cn("grid min-h-[58px] w-full grid-cols-[38px_minmax(0,1fr)_20px] items-center gap-2 rounded-lg bg-muted/50 p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "bg-accent text-foreground")} onClick={onClick} aria-label={actionLabel} aria-current={active ? "page" : undefined}>
    {imageUrl ? <img className="size-[38px] rounded-lg object-cover" src={imageUrl} alt="" /> : <span className="flex size-[38px] items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>}
    <span className="min-w-0"><strong className="block truncate text-xs">{name}</strong><small className="mt-1 block truncate text-[10px] text-muted-foreground">{subtitle}</small></span>
    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
  </button>;
}
