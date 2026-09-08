import { BriefcaseBusiness, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BookingHubScope } from "@/features/bookings/types/booking-hub";

interface BookingScopeSwitcherProps {
  onValueChange: (scope: BookingHubScope) => void;
  value: BookingHubScope;
}

const options = [
  { value: "incoming", label: "Incoming bookings", icon: BriefcaseBusiness },
  { value: "purchases", label: "Services I booked", icon: ShoppingBag },
] as const;

function BookingScopeSwitcher({ onValueChange, value }: BookingScopeSwitcherProps) {
  return (
    <div className="inline-flex w-full rounded-xl border border-border bg-secondary/60 p-1 sm:w-auto" aria-label="Booking collection">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
              isActive ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={isActive}
            onClick={() => onValueChange(option.value)}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { BookingScopeSwitcher };
