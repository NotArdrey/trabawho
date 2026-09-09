import { useEffect, useRef, type PointerEvent } from "react";
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
  const selectedRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState>({ pointerId: null, startX: 0, startScrollLeft: 0, moved: false });
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [value]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !scrollRef.current) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: scrollRef.current.scrollLeft, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId || !scrollRef.current) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) drag.moved = true;
    scrollRef.current.scrollLeft = drag.startScrollLeft - distance;
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const chooseOption = (optionValue: WorkSectionValue) => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    onValueChange(optionValue);
  };

  return (
    <section className="mb-4 border-b pb-4 min-[761px]:rounded-xl min-[761px]:border min-[761px]:bg-card min-[761px]:p-4" aria-labelledby="work-section-filter-title">
      <div className="mb-3 flex items-center gap-2 min-[761px]:hidden">
        <ListFilter className="size-4 text-brand-highlight-foreground" aria-hidden="true" />
        <div>
          <h2 id="work-section-filter-title" className="text-sm font-bold text-foreground">Work section</h2>
          <p className="text-xs text-muted-foreground">Choose an operational queue.</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex cursor-grab touch-pan-x select-none gap-2 overflow-x-auto overscroll-x-contain pb-1 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[761px]:hidden"
        role="group"
        aria-label="Work sections"
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
              ref={active ? selectedRef : undefined}
              type="button"
              className={cn(
                "min-h-11 shrink-0 rounded-full border border-transparent bg-muted px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "border-brand-highlight-border bg-brand-highlight-soft text-brand-highlight-foreground hover:text-brand-highlight-foreground",
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
