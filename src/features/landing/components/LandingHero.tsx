import { type FormEvent, useState } from "react";
import { ArrowRight, BadgeCheck, CalendarClock, MapPin, MessageCircle, Search, ShieldCheck, Star } from "lucide-react";

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
    <section className="relative isolate overflow-hidden border-b bg-background pt-16" aria-labelledby="landing-hero-title">
      <img
        className="absolute inset-0 -z-20 size-full object-cover object-[72%_center] sm:object-center"
        src="/images/landing-services-hero-v2.jpg"
        alt="A local appliance technician repairing a washing machine in a bright home"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/95 to-background/70 sm:via-background/85 sm:to-background/20 lg:via-background/65 dark:from-background dark:via-background/90 dark:to-background/60 sm:dark:to-background/35" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background/70 to-transparent" aria-hidden="true" />

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

          <div className="relative mt-8 min-h-36 lg:hidden" aria-label="Information available before booking">
            <div className="absolute left-0 top-0 max-w-[18rem] origin-bottom-left motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-75 motion-safe:fill-mode-backwards motion-safe:delay-100 motion-safe:duration-500">
              <div className="relative rounded-[1.35rem] rounded-bl-md bg-brand-highlight-strong px-4 py-3 text-white shadow-xl shadow-black/15">
                <p className="flex items-center gap-2 font-bold"><MessageCircle className="size-5" aria-hidden="true" />Make a more informed choice</p>
                <p className="mt-1 text-sm text-white/90">Compare real reviews and availability.</p>
                <span className="absolute -bottom-2 left-7 size-4 rotate-45 rounded-sm bg-brand-highlight-strong" aria-hidden="true" />
              </div>
            </div>
            <div className="absolute bottom-0 right-0 flex origin-bottom-right items-center gap-2 rounded-2xl rounded-br-md border border-white/70 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-900 shadow-lg backdrop-blur motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-75 motion-safe:fill-mode-backwards motion-safe:delay-300 motion-safe:duration-500">
              <Star className="size-4 fill-brand-highlight text-brand-highlight" aria-hidden="true" />4.9 verified rating
            </div>
          </div>
        </div>

        <div className="relative mx-auto hidden min-h-[27rem] w-full max-w-xl lg:block lg:max-w-none" aria-label="Information available before booking">
          <div className="absolute left-2 top-20 max-w-[20rem] origin-bottom-left motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-75 motion-safe:fill-mode-backwards motion-safe:delay-100 motion-safe:duration-500">
            <div className="relative rounded-[1.4rem] rounded-bl-md bg-brand-highlight-strong px-5 py-4 text-white shadow-xl shadow-black/15">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20"><MessageCircle className="size-5" aria-hidden="true" /></span>
                <div>
                  <p className="font-bold">Make a more informed choice</p>
                  <p className="mt-1 text-sm leading-5 text-white/90">Compare verified details before you book.</p>
                </div>
              </div>
              <span className="absolute -bottom-2 left-7 size-5 rotate-45 rounded-sm bg-brand-highlight-strong" aria-hidden="true" />
            </div>
          </div>

          <div className="absolute right-2 top-5 origin-bottom-right motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-75 motion-safe:fill-mode-backwards motion-safe:delay-300 motion-safe:duration-500">
            <div className="flex items-center gap-2 rounded-2xl rounded-br-md border border-white/70 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur">
              <BadgeCheck className="size-5 text-primary" aria-hidden="true" />
              Identity verified
            </div>
          </div>

          <div className="absolute bottom-16 left-16 origin-bottom-left motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-75 motion-safe:fill-mode-backwards motion-safe:delay-500 motion-safe:duration-500">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/70 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur">
              <Star className="size-5 fill-brand-highlight text-brand-highlight" aria-hidden="true" />
              4.9 from verified reviews
            </div>
          </div>

          <div className="absolute bottom-4 right-0 origin-bottom-right motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-75 motion-safe:fill-mode-backwards motion-safe:delay-700 motion-safe:duration-500">
            <div className="flex items-center gap-2 rounded-2xl rounded-br-md border border-white/70 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur">
              <CalendarClock className="size-5 text-primary" aria-hidden="true" />
              Saturday · 10:00 AM
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
