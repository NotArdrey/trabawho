import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export default function BrandWordmark({ className, ...props }: ComponentProps<"span">) {
  return (
    <span className={cn("inline-flex items-baseline font-bold tracking-tight", className)} {...props}>
      <span className="text-[var(--brand-blue)]">Traba</span>
      <span className="text-brand-highlight">Who</span>
    </span>
  );
}
