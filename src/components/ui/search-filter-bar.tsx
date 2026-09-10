import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
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
  const railRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });
  const suppressClickRef = useRef(false);

  useEffect(() => {
    buttonRefs.current.get(activeValue || "")?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeValue]);

  const handleRailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !railRef.current) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: railRef.current.scrollLeft, moved: false };
  };

  const handleRailPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    const drag = dragRef.current;
    if (!rail || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) {
      drag.moved = true;
      if (!rail.hasPointerCapture?.(event.pointerId)) rail.setPointerCapture?.(event.pointerId);
      rail.scrollLeft = drag.scrollLeft - distance;
    }
  };

  const handleRailPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (dragRef.current.pointerId !== event.pointerId) return;
    suppressClickRef.current = dragRef.current.moved;
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    if (rail?.hasPointerCapture?.(event.pointerId)) rail.releasePointerCapture?.(event.pointerId);
    dragRef.current.pointerId = -1;
  };

  const handleRailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const currentIndex = options.findIndex((option) => option.value === activeValue);
    const nextIndex = Math.min(options.length - 1, Math.max(0, currentIndex + (event.key === "ArrowRight" ? 1 : -1)));
    const nextOption = options[nextIndex];
    if (!nextOption || nextIndex === currentIndex) return;
    event.preventDefault();
    onActiveValueChange?.(nextOption.value);
    buttonRefs.current.get(nextOption.value)?.focus();
  };

  return (
    <section
      className={cn("min-w-0 max-w-full rounded-xl border border-border bg-card p-4 text-card-foreground shadow-none", className)}
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
              aria-label={`Clear ${searchLabel.replace(/^search\s+/i, "")}`}
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
        <div className="mt-3 min-w-0 max-w-full border-t border-border pt-3">
          <div
            ref={railRef}
            className="-mx-1 flex w-full min-w-0 cursor-grab touch-pan-x gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-2 scroll-px-1 select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Filter results"
            role="toolbar"
            onKeyDown={handleRailKeyDown}
            onPointerDown={handleRailPointerDown}
            onPointerMove={handleRailPointerMove}
            onPointerUp={handleRailPointerUp}
            onPointerCancel={handleRailPointerUp}
          >
            {options.map((option) => {
              const isActive = activeValue === option.value;
              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    if (node) buttonRefs.current.set(option.value, node);
                    else buttonRefs.current.delete(option.value);
                  }}
                  type="button"
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                  aria-label={typeof option.count === "number" ? `${option.label}, ${option.count}` : option.label}
                  aria-pressed={isActive}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    onActiveValueChange?.(option.value);
                  }}
                >
                  {option.label}
                  {typeof option.count === "number" ? (
                    <span
                      className={cn(
                        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs",
                        isActive ? "bg-white/20 text-white" : "bg-secondary text-secondary-foreground",
                      )}
                    >
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
