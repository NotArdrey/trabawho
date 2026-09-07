import {
  ArrowRight,
  BookOpen,
  BrushCleaning,
  CalendarDays,
  Grid2X2,
  HeartHandshake,
  Palette,
  PlugZap,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { LandingCategory, LandingSearchParams } from "../types";

interface CategoryDefinition extends LandingCategory {
  icon: LucideIcon;
}

const categories: CategoryDefinition[] = [
  { label: "Cleaning", query: "Cleaning", description: "Home and space cleaning", icon: BrushCleaning },
  { label: "Home Repair", query: "Home repair", description: "Repairs and maintenance", icon: Wrench },
  { label: "Tutoring", query: "Tutor", description: "Academic learning support", icon: BookOpen },
  { label: "Electrical", query: "Electrical", description: "Installation and repair", icon: PlugZap },
  { label: "Beauty & Wellness", query: "Beauty wellness", description: "Personal care services", icon: HeartHandshake },
  { label: "Events", query: "Event", description: "Setup and event support", icon: CalendarDays },
  { label: "Creative Services", query: "Creative design", description: "Design and creative work", icon: Palette },
  { label: "All Services", description: "Explore every category", icon: Grid2X2 },
];

interface LandingCategoriesProps {
  onSelect: (search: LandingSearchParams) => void;
}

export default function LandingCategories({ onSelect }: LandingCategoriesProps) {
  return (
    <section className="bg-muted/35 py-14 sm:py-16" aria-labelledby="categories-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-primary">Explore services</p>
            <h2 id="categories-title" className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              What can we help you with?
            </h2>
          </div>
          <button
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-md px-1 text-sm font-semibold text-primary hover:text-primary/80"
            onClick={() => onSelect({})}
            type="button"
          >
            Browse all services <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.map(({ icon: Icon, ...category }) => (
            <button
              className="group min-h-36 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 sm:p-5"
              key={category.label}
              onClick={() => onSelect({ query: category.query })}
              type="button"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-4 block font-semibold text-foreground">{category.label}</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">{category.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
