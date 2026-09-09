import { Filter, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface MarketplaceCategoryFilter {
  label: string;
  count: number;
}

interface MarketplaceFilterPanelProps {
  activeCategory: string;
  categories: MarketplaceCategoryFilter[];
  districts: string[];
  hasActiveFilters: boolean;
  isOpen: boolean;
  isPublic: boolean;
  locationQuery: string;
  onCategoryChange: (category: string) => void;
  onClear: () => void;
  onClose: () => void;
  onDistrictChange: (district: string) => void;
  onLocationChange: (value: string) => void;
  selectedDistrict: string;
}

export function MarketplaceFilterPanel({
  activeCategory,
  categories,
  districts,
  hasActiveFilters,
  isOpen,
  isPublic,
  locationQuery,
  onCategoryChange,
  onClear,
  onClose,
  onDistrictChange,
  onLocationChange,
  selectedDistrict,
}: MarketplaceFilterPanelProps) {
  return (
    <aside
      id="browse-filter-options"
      className={cn(
        "sticky top-[78px] col-start-2 row-start-1 grid self-start overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
        "max-[1180px]:col-start-1 max-[1180px]:row-auto max-[1180px]:w-full",
        "max-[880px]:fixed max-[880px]:inset-x-3 max-[880px]:bottom-[76px] max-[880px]:top-[76px] max-[880px]:z-[60] max-[880px]:flex max-[880px]:flex-col max-[880px]:shadow-lg",
        !isOpen && "max-[880px]:hidden",
      )}
      aria-label="Browse filters"
    >
      <header className="flex min-h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Filter className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Filters</h2>
          <p className="text-xs text-muted-foreground max-[880px]:block min-[881px]:hidden">
            Narrow the services shown
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden max-[880px]:inline-flex"
          onClick={onClose}
          aria-label="Close filters"
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <div className="grid gap-5 p-4 max-[880px]:min-h-0 max-[880px]:flex-1 max-[880px]:overflow-y-auto">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Category
          </legend>
          <div className="grid grid-cols-2 gap-2 min-[1181px]:grid-cols-1" aria-label="Service categories">
            {categories.map(({ label, count }) => {
              const isActive = activeCategory === label;
              return (
                <button
                  key={label}
                  className={cn(
                    "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors",
                    "hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive && [
                      "border-brand-highlight-border bg-brand-highlight-soft text-brand-highlight-foreground",
                      "min-[881px]:border-primary/30 min-[881px]:bg-primary/10 min-[881px]:text-primary",
                    ],
                  )}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onCategoryChange(label)}
                >
                  <span className="min-w-0 leading-tight">{label}</span>
                  <span
                    className={cn(
                      "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground",
                      isActive && "bg-brand-highlight-strong text-white min-[881px]:bg-primary min-[881px]:text-primary-foreground",
                    )}
                    aria-label={`${count} services`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {isPublic ? (
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Location
            <span className="relative block">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
              <input
                className="min-h-11 w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                value={locationQuery}
                onChange={(event) => onLocationChange(event.target.value)}
                placeholder="City or province"
              />
            </span>
          </label>
        ) : (
          <div className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>District</span>
            <Select value={selectedDistrict} onValueChange={onDistrictChange}>
              <SelectTrigger className="font-normal normal-case tracking-normal" aria-label="Filter by district">
                <SelectValue placeholder="All districts" />
              </SelectTrigger>
              <SelectContent position="popper">
                {districts.map((district) => (
                  <SelectItem key={district} value={district}>{district}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <footer className="border-t border-border p-4">
        <Button type="button" variant="secondary" className="w-full" onClick={onClear} disabled={!hasActiveFilters}>
          Clear filters
        </Button>
      </footer>
    </aside>
  );
}
