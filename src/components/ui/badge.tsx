import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

const variants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border bg-background text-foreground",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <span className={cn("inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-xs font-semibold", variants[variant], className)} {...props} />;
}

export { Badge };
