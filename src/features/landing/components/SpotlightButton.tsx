import { type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export default function SpotlightButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn("group relative isolate overflow-hidden", className)}
    >
      <span
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none [background:radial-gradient(220px_circle_at_15%_15%,var(--brand-highlight-soft),transparent_72%)]"
        aria-hidden="true"
      />
      {children}
    </button>
  );
}
