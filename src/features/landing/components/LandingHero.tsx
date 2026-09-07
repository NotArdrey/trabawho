import { type FormEvent, useState } from "react";
import { ArrowRight, MapPin, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { LandingSearchParams } from "../types";

const popularSearches = ["Cleaning", "Tutoring", "Home repair", "Graphic design"];

interface LandingHeroProps {
  onSearch: (search: LandingSearchParams) => void;
}

export default function LandingHero({ onSearch }: LandingHeroProps) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch({ query, location });
  };

  return (
    <section className="relative overflow-hidden border-b bg-background pt-16" aria-labelledby="landing-hero-title">
      <svg
        className="pointer-events-none absolute -left-24 top-14 h-[34rem] w-[52rem] text-primary opacity-[0.07] dark:opacity-[0.11]"
        viewBox="0 0 832 544"
        fill="none"
        aria-hidden="true"
      >
        <path d="M0 72H832M0 152H832M0 232H832M0 312H832M0 392H832M0 472H832" stroke="currentColor" />
        <path d="M88 0V544M200 0V544M312 0V544M424 0V544M536 0V544M648 0V544M760 0V544" stroke="currentColor" />
        <path d="M88 392L200 312L312 344L424 216L536 248L648 136L760 184" stroke="currentColor" strokeWidth="2" />
        <circle cx="200" cy="312" r="7" fill="currentColor" />
        <circle cx="424" cy="216" r="7" fill="currentColor" />
        <circle cx="648" cy="136" r="7" fill="currentColor" />
      </svg>

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-20">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Local services, easier to compare
          </div>

          <h1
            id="landing-hero-title"
            className="text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl"
          >
            Find trusted local help, right when you need it.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Compare service details, rates, reviews, and available schedules from local providers in one place.
          </p>

          <form className="mt-8 rounded-xl border bg-card p-3" onSubmit={handleSubmit} role="search">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_auto] md:items-end">
              <div className="grid gap-2">
                <Label htmlFor="landing-service-search">What service do you need?</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="landing-service-search"
                    className="pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="e.g. aircon cleaning"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="landing-location-search">Location</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="landing-location-search"
                    className="pl-9"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="City or province"
                    autoComplete="address-level2"
                  />
                </div>
              </div>

              <Button className="w-full md:w-auto" size="lg" type="submit">
                Search
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-muted-foreground">Popular:</span>
            {popularSearches.map((term) => (
              <button
                className="min-h-11 rounded-md border bg-background px-3 font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted"
                key={term}
                onClick={() => onSearch({ query: term, location })}
                type="button"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="overflow-hidden rounded-xl border bg-muted">
            <img
              className="aspect-[4/3] h-full w-full object-cover"
              src="https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&h=900&fit=crop&auto=format&q=82"
              alt="A service technician preparing tools for a local job"
              fetchPriority="high"
            />
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-lg border bg-background/95 p-4 backdrop-blur-sm sm:left-6 sm:right-auto sm:max-w-xs">
            <p className="text-sm font-semibold text-foreground">Make a more informed choice</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Review provider information, pricing, and scheduling options before you book.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
