import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardTone = "blue" | "sky" | "green" | "orange" | "neutral";

interface MetricCardProps {
  actionLabel?: string;
  detail?: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  tone?: MetricCardTone;
  value: string;
}

const toneStyles: Record<MetricCardTone, { card: string; icon: string; watermark: string }> = {
  blue: {
    card: "bg-blue-50/70 dark:bg-blue-950/25",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200",
    watermark: "text-blue-700 dark:text-blue-300",
  },
  sky: {
    card: "bg-sky-50/70 dark:bg-sky-950/20",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200",
    watermark: "text-sky-700 dark:text-sky-300",
  },
  green: {
    card: "bg-emerald-50/70 dark:bg-emerald-950/20",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200",
    watermark: "text-emerald-700 dark:text-emerald-300",
  },
  orange: {
    card: "bg-brand-highlight-soft",
    icon: "bg-brand-highlight-soft text-brand-highlight-foreground",
    watermark: "text-brand-highlight",
  },
  neutral: {
    card: "bg-card",
    icon: "bg-secondary text-secondary-foreground",
    watermark: "text-foreground",
  },
};

function MetricCard({ actionLabel, detail, icon: Icon, label, onClick, tone = "blue", value }: MetricCardProps) {
  const styles = toneStyles[tone];
  const baseClassName = cn(
    "relative min-h-28 min-w-0 overflow-hidden rounded-xl border border-border text-left shadow-none",
    styles.card,
    onClick && "w-full cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
  const content = (
    <>
      <Icon className={cn("pointer-events-none absolute -bottom-4 -right-3 size-24 opacity-[0.07] dark:opacity-10", styles.watermark)} aria-hidden="true" />
      {onClick ? (
        <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground" aria-hidden="true">
          <ArrowUpRight className="size-3.5" />
        </span>
      ) : null}
      <CardContent className="relative flex items-start gap-2.5 p-3 pr-9 sm:gap-3 sm:p-4 sm:pr-11">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10", styles.icon)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
          <h2 className="text-sm font-semibold leading-tight">{label}</h2>
          {detail ? <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground sm:max-w-[12rem] sm:leading-5">{detail}</p> : null}
        </div>
      </CardContent>
    </>
  );

  if (onClick) {
    return <button type="button" className={baseClassName} onClick={onClick} aria-label={actionLabel || `Open ${label}`}>{content}</button>;
  }

  return <Card className={baseClassName}>{content}</Card>;
}

export { MetricCard };
export type { MetricCardProps, MetricCardTone };
