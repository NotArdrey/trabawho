import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchFilterOption {
  value: string;
  label: string;
  count?: number;
}

interface SearchFilterBarProps {
  activeValue?: string;
  className?: string;
  endControl?: ReactNode;
  onActiveValueChange?: (value: string) => void;
  onSearchValueChange: (value: string) => void;
  options?: SearchFilterOption[];
  resultLabel?: string;
  searchLabel: string;
  searchPlaceholder?: string;
  searchValue: string;
}

function SearchFilterBar({
  activeValue,
  className,
  endControl,
  onActiveValueChange,
  onSearchValueChange,
  options = [],
  resultLabel,
  searchLabel,
  searchPlaceholder,
  searchValue,
}: SearchFilterBarProps) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-card p-4 text-card-foreground shadow-none", className)}
      aria-label="Search and filters"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
          className="pr-11 pl-10 shadow-none focus-visible:border-primary focus-visible:ring-0"
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
          />
          {searchValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchValueChange("")}
              aria-label={`Clear ${searchLabel.toLowerCase()}`}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        {resultLabel ? (
          <p className="shrink-0 text-sm font-medium text-muted-foreground" aria-live="polite">
            {resultLabel}
          </p>
        ) : null}
        {endControl}
      </div>

      {options.length > 0 ? (
        <div className="mt-3 border-t border-border pt-3">
          <div
            className="flex touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Filter results"
          >
          {options.map((option) => {
            const isActive = activeValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
                aria-pressed={isActive}
                onClick={() => onActiveValueChange?.(option.value)}
              >
                {option.label}
                {typeof option.count === "number" ? (
                  <span className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs",
                    isActive ? "bg-white/20 text-white" : "bg-secondary text-secondary-foreground",
                  )}>
                    {option.count}
                  </span>
                ) : null}
              </button>
            );
          })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export { SearchFilterBar };
