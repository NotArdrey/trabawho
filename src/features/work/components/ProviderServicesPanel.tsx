import { useState } from "react";
import { CalendarCheck, MessageSquareText, Star, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowPanel, WorkflowStatGrid } from "@/components/ui/workflow-panel";
import type { ProviderServiceHealth, ProviderServiceListing } from "@/features/work/types/provider-dashboard";

interface ProviderServicesPanelProps {
  health: ProviderServiceHealth;
  listings: readonly ProviderServiceListing[];
  onManageServices?: () => void;
}

const visibleCount = 4;

export function ProviderServicesPanel({ health, listings, onManageServices }: ProviderServicesPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? listings : listings.slice(0, visibleCount);

  return (
    <WorkflowPanel
      icon={Store}
      title="Your services"
      description="Listings, available times, and client feedback at a glance."
      tone="primary"
      action={<Button type="button" size="sm" onClick={onManageServices}><Store aria-hidden="true" />Manage services</Button>}
    >
      <WorkflowStatGrid aria-label="Your services statistics" items={[
        { id: "listings", icon: Store, tone: "primary", label: "Active listings", value: health.activeListings },
        { id: "slots", icon: CalendarCheck, tone: "success", label: "Available slots", value: health.availableSlots },
        { id: "rating", icon: Star, tone: "highlight", label: "Provider rating", value: health.rating ?? "—" },
        { id: "reviews", icon: MessageSquareText, tone: "primary", label: "Published reviews", value: health.reviewCount },
      ]} />

      <div className="border-t">
        <div className="px-4 pb-2 pt-5 sm:px-5">
          <h3 className="text-sm font-bold text-foreground">Active listings</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Booking options and next open times for each service.</p>
        </div>
        {listings.length ? <ul className="divide-y" aria-label="Active service listings">
          {displayed.map((listing) => <li key={listing.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Store className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="font-semibold leading-5 text-foreground">{listing.title}</p>
                {listing.description ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{listing.description}</p> : null}
                <Badge variant="outline" className="mt-2">{listing.bookingType}</Badge>
              </div>
            </div>
            <div className="min-w-0 pl-[52px] text-sm sm:max-w-52 sm:shrink-0 sm:pl-0 sm:text-right">
              {listing.bookingType === "Time-slot booking" ? <>
                <p className="font-semibold text-foreground">{listing.availableSlots} open {listing.availableSlots === 1 ? "slot" : "slots"}</p>
                <p className="mt-1 leading-5 text-muted-foreground">{listing.nextOpenAt ? `Next: ${listing.nextOpenAt}` : "No upcoming open times"}</p>
              </> : <p className="font-medium text-muted-foreground">Schedule arranged with client</p>}
            </div>
          </li>)}
        </ul> : <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">No active listings yet. Add a service to make your work available to clients.</p>}
        {listings.length > visibleCount ? <div className="border-t px-4 py-2 sm:px-5">
          <Button type="button" variant="ghost" className="min-h-11" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Show fewer listings" : `Show all ${listings.length} listings`}
          </Button>
        </div> : null}
      </div>
    </WorkflowPanel>
  );
}
