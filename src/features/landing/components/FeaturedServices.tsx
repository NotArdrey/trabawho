import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, MapPin, Star, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

import { fetchFeaturedServices } from "../services/featured-services";
import type { LandingFeaturedService, LandingSearchParams } from "../types";

interface FeaturedServicesProps {
  onSelect: (search: LandingSearchParams) => void;
}

function ServiceCard({
  service,
  onSelect,
}: {
  service: LandingFeaturedService;
  onSelect: (search: LandingSearchParams) => void;
}) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const [failedProviderPhoto, setFailedProviderPhoto] = useState<string>();
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
      {service.photoUrl && failedPhoto !== service.photoUrl && (
        <div className="aspect-[16/9] max-h-48 overflow-hidden bg-muted">
          <img
            className="h-full w-full object-cover"
            src={service.photoUrl}
            alt={`${service.title}, shared by ${service.providerName}`}
            loading="lazy"
            onError={() => setFailedPhoto(service.photoUrl)}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          {service.serviceType.toLowerCase() !== service.title.toLowerCase() && (
            <p className="min-w-0 break-words text-sm font-semibold text-primary">{service.serviceType}</p>
          )}
          {service.isVerified && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> Verified provider
            </span>
          )}
        </div>
        <h3 className="mt-2 break-words text-lg font-bold text-foreground">{service.title}</h3>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          {service.providerPhotoUrl && failedProviderPhoto !== service.providerPhotoUrl ? (
            <img className="size-9 shrink-0 rounded-full object-cover" src={service.providerPhotoUrl}
              alt="" loading="lazy" onError={() => setFailedProviderPhoto(service.providerPhotoUrl)} />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserRound className="size-4" aria-hidden="true" />
            </span>
          )}
          <p className="min-w-0 break-words font-medium">{service.providerName}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {service.rating !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 fill-brand-highlight text-brand-highlight" aria-hidden="true" />
              {service.rating.toFixed(1)}
              {service.reviewCount !== undefined && ` · ${service.reviewCount} provider ${service.reviewCount === 1 ? "review" : "reviews"}`}
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

        <div className="mt-auto pt-5">
          <div className="flex flex-col gap-3 border-t pt-4">
            <span className="break-words text-sm font-bold text-foreground">{service.priceLabel || "Ask provider for pricing"}</span>
            <Button variant="outline" className="w-full" onClick={() => onSelect({ query: service.title })}>
              Browse similar services
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ServiceSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" aria-hidden="true">
      <div className="space-y-3 p-5">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-6 w-4/5 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-11 rounded bg-muted" />
      </div>
    </div>
  );
}

export default function FeaturedServices({ onSelect }: FeaturedServicesProps) {
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
        <div>
          <p className="text-sm font-semibold text-primary">Explore TrabaWho</p>
          <h2 id="featured-services-title" className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Recently listed services
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Discover services shared by providers. Compare details and confirm pricing and schedules before booking.
          </p>
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
            <p className="font-semibold text-foreground">No services have been listed yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">Browse all services or check back later.</p>
          </div>
        )}
      </div>
    </section>
  );
}
