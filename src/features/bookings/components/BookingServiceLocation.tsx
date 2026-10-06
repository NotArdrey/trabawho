import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readServiceAddress, serviceAddressText, serviceMapsUrl } from '@/shared/domain/serviceAddress';

export function BookingServiceLocation({ metadata }: { metadata: unknown }) {
  const address = readServiceAddress(metadata && typeof metadata === 'object' && 'service_address' in metadata ? metadata.service_address : null);
  if (!address) return null;
  return <section className="space-y-2 rounded-xl border bg-card p-4" aria-label="Service location">
    <h3 className="flex items-center gap-2 font-bold"><MapPin className="size-5 text-primary" aria-hidden="true" />Service location</h3>
    <p className="break-words text-sm">{serviceAddressText(address)}</p>
    <Button asChild variant="outline"><a href={serviceMapsUrl(address)} target="_blank" rel="noopener noreferrer">
      <MapPin aria-hidden="true" />{address.pin ? 'View service pin on Google Maps' : 'Search address on Google Maps'}<span className="sr-only"> (opens in a new tab)</span>
    </a></Button>
  </section>;
}
