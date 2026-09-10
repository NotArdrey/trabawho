import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { ListFilter } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type WorkSectionValue = "all" | "inquiries" | "cash-approvals" | "refunds" | "cancelled" | "schedule";

export interface WorkSectionOption {
  value: WorkSectionValue;
  label: string;
  shortLabel: string;
  description: string;
}

export interface WorkSectionFilterProps {
  value: WorkSectionValue;
  options: readonly WorkSectionOption[];
  onValueChange: (value: WorkSectionValue) => void;
}

interface DragState {
  pointerId: number | null;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
}

export default function WorkSectionFilter({ value, options, onValueChange }: WorkSectionFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<WorkSectionValue, HTMLButtonElement>());
  const dragRef = useRef<DragState>({ pointerId: null, startX: 0, startScrollLeft: 0, moved: false });
  const suppressClickRef = useRef(false);
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    buttonRefs.current.get(value)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [value]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !scrollRef.current) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: scrollRef.current.scrollLeft, moved: false };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId || !scrollRef.current) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) {
      drag.moved = true;
      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.setPointerCapture?.(event.pointerId);
      scrollRef.current.scrollLeft = drag.startScrollLeft - distance;
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    suppressClickRef.current = dragRef.current.moved;
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current.pointerId = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const chooseOption = (optionValue: WorkSectionValue) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onValueChange(optionValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const currentIndex = options.findIndex((option) => option.value === value);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextOption = options[Math.min(options.length - 1, Math.max(0, currentIndex + direction))];
    if (!nextOption || nextOption.value === value) return;
    event.preventDefault();
    onValueChange(nextOption.value);
    buttonRefs.current.get(nextOption.value)?.focus();
  };

  return (
    <section className="mb-4 min-w-0 max-w-full rounded-xl border border-border bg-card p-4" aria-label="Work section filter">
      <div className="mb-3 flex min-w-0 items-center gap-3 min-[761px]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
          <ListFilter className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">Work section</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground" aria-live="polite">{activeOption?.description}</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 cursor-grab touch-pan-x select-none gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pb-1 scroll-px-4 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[761px]:hidden"
        role="toolbar"
        aria-label="Work sections"
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              ref={(node) => {
                if (node) buttonRefs.current.set(option.value, node);
                else buttonRefs.current.delete(option.value);
              }}
              type="button"
              className={cn(
                "min-h-11 shrink-0 rounded-full border border-transparent bg-muted px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-brand-highlight-strong text-white hover:text-white",
              )}
              aria-pressed={active}
              onClick={() => chooseOption(option.value)}
            >
              {option.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="hidden items-center justify-between gap-6 min-[761px]:flex">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <ListFilter className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">Work section</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{activeOption?.description}</p>
          </div>
        </div>
        <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as WorkSectionValue)}>
          <SelectTrigger className="w-[min(36vw,280px)] min-w-56 shrink-0 shadow-none" aria-label="Choose work section"><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
