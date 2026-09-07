import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, MapPin, Star } from "lucide-react";

import { Button } from "@/components/ui/button";

import { fetchFeaturedServices } from "../services/featured-services";
import type { LandingFeaturedService, LandingSearchParams } from "../types";

interface FeaturedServicesProps {
  onBrowseAll: () => void;
  onSelect: (search: LandingSearchParams) => void;
}

function ServiceCard({
  service,
  onSelect,
}: {
  service: LandingFeaturedService;
  onSelect: (search: LandingSearchParams) => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        {service.photoUrl ? (
          <img
            className="h-full w-full object-cover"
            src={service.photoUrl}
            alt={`${service.providerName}, ${service.serviceType} provider`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-medium text-muted-foreground">
            {service.serviceType}
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-primary">{service.serviceType}</p>
          {service.isVerified && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="size-4" aria-hidden="true" /> Verified
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-lg font-bold text-foreground">{service.title}</h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{service.providerName}</p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {service.rating !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 text-amber-500" fill="currentColor" aria-hidden="true" />
              {service.rating.toFixed(1)}
              {service.reviewCount !== undefined && ` (${service.reviewCount})`}
            </span>
          )}
          {service.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden="true" /> {service.location}
            </span>
          )}
          {service.availabilityLabel && (
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="size-4" aria-hidden="true" /> {service.availabilityLabel}
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-sm font-bold text-foreground">{service.priceLabel || "View pricing"}</span>
          <Button variant="outline" onClick={() => onSelect({ query: service.serviceType })}>
            View service
          </Button>
        </div>
      </div>
    </article>
  );
}

function ServiceSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" aria-hidden="true">
      <div className="aspect-[16/10] bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-6 w-4/5 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-11 rounded bg-muted" />
      </div>
    </div>
  );
}

export default function FeaturedServices({ onBrowseAll, onSelect }: FeaturedServicesProps) {
  const [services, setServices] = useState<LandingFeaturedService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadServices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      setServices(await fetchFeaturedServices());
    } catch {
      setError("Featured services are unavailable right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchFeaturedServices()
      .then((nextServices) => {
        if (active) setServices(nextServices);
      })
      .catch(() => {
        if (active) setError("Featured services are unavailable right now.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="py-14 sm:py-20" aria-labelledby="featured-services-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-primary">Available on TrabaWho</p>
            <h2 id="featured-services-title" className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              Featured local services
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Explore active listings and compare the information each provider has shared.
            </p>
          </div>
          <Button className="self-start" variant="outline" onClick={onBrowseAll}>Browse all services</Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={isLoading}>
          {isLoading && Array.from({ length: 4 }, (_, index) => <ServiceSkeleton key={index} />)}
          {!isLoading && services.map((service) => (
            <ServiceCard key={service.id} service={service} onSelect={onSelect} />
          ))}
        </div>

        {!isLoading && error && (
          <div className="mt-8 rounded-xl border bg-muted/30 p-6 text-center" role="alert">
            <p className="font-semibold text-foreground">{error}</p>
            <Button className="mt-4" variant="outline" onClick={() => void loadServices()}>Try again</Button>
          </div>
        )}

        {!isLoading && !error && services.length === 0 && (
          <div className="mt-8 rounded-xl border bg-muted/30 p-8 text-center">
            <p className="font-semibold text-foreground">No featured services are available yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">Browse all services or check back later.</p>
          </div>
        )}
      </div>
    </section>
  );
}
