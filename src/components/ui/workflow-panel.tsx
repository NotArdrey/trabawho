import { useId, type HTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type WorkflowTone = "primary" | "highlight" | "success" | "neutral";

const toneStyles: Record<WorkflowTone, { header: string; icon: string }> = {
  primary: { header: "bg-primary/5", icon: "bg-primary/10 text-primary" },
  highlight: { header: "bg-brand-highlight-soft/60", icon: "bg-brand-highlight-soft text-brand-highlight-foreground" },
  success: { header: "bg-emerald-50/70 dark:bg-emerald-950/25", icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" },
  neutral: { header: "bg-muted/35", icon: "bg-secondary text-secondary-foreground" },
};

export interface WorkflowPanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  description?: ReactNode;
  icon: LucideIcon;
  status?: ReactNode;
  title: ReactNode;
  tone?: WorkflowTone;
}

function WorkflowPanel({ action, children, className, contentClassName, description, icon: Icon, status, title, tone = "neutral", ...props }: WorkflowPanelProps) {
  const titleId = useId();
  const styles = toneStyles[tone];

  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card text-card-foreground", className)} aria-labelledby={titleId} {...props}>
      <header className={cn("flex items-start gap-3 border-b px-4 py-4 sm:px-5", styles.header)}>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 self-center">
          <h2 id={titleId} className="font-bold leading-tight text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {status ? <div className="shrink-0 self-start">{status}</div> : null}
        {action ? <div className="hidden shrink-0 self-center sm:block">{action}</div> : null}
      </header>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
      {action ? <footer className="border-t p-3 sm:hidden [&>*]:w-full">{action}</footer> : null}
    </section>
  );
}

export interface WorkflowEmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  action?: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  title: ReactNode;
  tone?: WorkflowTone;
}

function WorkflowEmptyState({ action, className, description, icon: Icon, title, tone = "neutral", ...props }: WorkflowEmptyStateProps) {
  const styles = toneStyles[tone];
  return (
    <div className={cn("flex min-h-40 flex-col items-center justify-center px-5 py-7 text-center", className)} {...props}>
      <span className={cn("flex size-11 items-center justify-center rounded-lg", styles.icon)}><Icon className="size-5" aria-hidden="true" /></span>
      <h3 className="mt-3 font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export interface WorkflowStatItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
}

export interface WorkflowStatGridProps extends HTMLAttributes<HTMLDListElement> {
  items: readonly WorkflowStatItem[];
}

function WorkflowStatGrid({ className, items, ...props }: WorkflowStatGridProps) {
  return (
    <dl className={cn("grid grid-cols-2 bg-muted/15 lg:grid-cols-4", className)} {...props}>
      {items.map((item, index) => (
        <div key={item.id} className={cn("flex min-h-24 flex-col justify-center px-4 py-4", index % 2 === 1 && "border-l", index >= 2 && "border-t", index > 0 && "lg:border-l", "lg:border-t-0")}>
          <dt className="text-xs font-medium leading-4 text-muted-foreground">{item.label}</dt>
          <dd className="order-first mb-1 text-xl font-bold tracking-tight text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { WorkflowEmptyState, WorkflowPanel, WorkflowStatGrid };
