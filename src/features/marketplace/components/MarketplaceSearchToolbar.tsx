import { Filter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MarketplaceSearchToolbarProps {
  searchQuery: string;
  sortMode: string;
  filtersOpen: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onToggleFilters: () => void;
}

export function MarketplaceSearchToolbar({
  searchQuery,
  sortMode,
  filtersOpen,
  onSearchChange,
  onSortChange,
  onToggleFilters,
}: MarketplaceSearchToolbarProps) {
  return (
    <section className="mb-3 grid min-w-0 gap-3 rounded-xl border border-border bg-card p-3 sm:p-4" aria-label="Search and filters">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          className="w-full min-w-0 pr-11 pl-10"
          aria-label="Search services and providers"
          placeholder="Search services, providers, or locations"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {searchQuery && (
          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2" onClick={() => onSearchChange("")} aria-label="Clear service search">
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="flex min-w-0 gap-2 min-[881px]:justify-end">
        <Select value={sortMode} onValueChange={onSortChange}>
          <SelectTrigger className="min-w-0 flex-1 min-[881px]:w-48 min-[881px]:flex-none" aria-label="Sort services">
            <SelectValue placeholder="Sort services" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="rating">Highest rated</SelectItem>
            <SelectItem value="price-low">Lowest listed price</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="secondary" className="shrink-0 min-[881px]:hidden" onClick={onToggleFilters} aria-expanded={filtersOpen} aria-controls="browse-filter-options">
          <Filter className="size-4" aria-hidden="true" />
          {filtersOpen ? "Hide filters" : "Filters"}
        </Button>
      </div>
      {sortMode === "price-low" && <p className="text-xs text-muted-foreground">Compares listed amounts. Billing units vary; services requiring a quote appear last.</p>}
    </section>
  );
}
