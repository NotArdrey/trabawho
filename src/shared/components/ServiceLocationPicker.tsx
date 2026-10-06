import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { serviceAddressText, type ServiceAddress } from '@/shared/domain/serviceAddress';
import { useServiceLocationPicker } from '@/shared/hooks/useServiceLocationPicker';
import { useServicePinAddress } from '@/shared/hooks/useServicePinAddress';
import type { PinAddressResult } from '@/shared/services/pinAddressLookup';

export function ServiceLocationPicker({ value, onConfirm, onClose, onRestoreFocus }: {
  value: ServiceAddress; onConfirm: (result: PinAddressResult) => void; onClose: () => void; onRestoreFocus: () => void;
}) {
  const { latitude, longitude, locating, locationError, container, state, tileError, pin,
    editCoordinate, locate, zoom, selectCenter, showCoordinates } = useServiceLocationPicker(value.pin);
  const { resolving, confirm } = useServicePinAddress(value, pin, onConfirm);

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-2xl gap-3 p-4 sm:p-6" onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
      <DialogHeader>
        <DialogTitle>Pin service location</DialogTitle>
        <DialogDescription>Tap the exact service location or drag the pin. Confirm to fill available address details, then check your house or unit number.</DialogDescription>
      </DialogHeader>
      <p className="break-words text-sm font-medium">{serviceAddressText(value)}</p>
      <p id="service-map-help" className="text-xs text-muted-foreground">Use your current location or zoom to the service area. Address text does not automatically position the pin. Keyboard: use arrow keys and +/− on the map, then choose “Place pin at map center.”</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={locating || state === 'loading'} onClick={locate}>
          <LocateFixed aria-hidden="true" />{locating ? 'Finding your location…' : 'Use current location'}
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Zoom in" disabled={state !== 'ready'} onClick={() => zoom(1)}><Plus aria-hidden="true" /></Button>
        <Button type="button" variant="outline" size="icon" aria-label="Zoom out" disabled={state !== 'ready'} onClick={() => zoom(-1)}><Minus aria-hidden="true" /></Button>
      </div>
      <Button type="button" variant="outline" disabled={state !== 'ready'} onClick={selectCenter}><MapPin aria-hidden="true" />Place pin at map center</Button>
      <div className="relative isolate overflow-hidden rounded-lg border">
        <div ref={container} role="region" aria-label="Service location map" aria-describedby="service-map-help"
          className="h-64 w-full bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-80" />
        <p className="absolute bottom-0 right-0 z-[1000] bg-background/95 px-2 text-xs text-foreground">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">OpenStreetMap contributors<span className="sr-only"> (opens in a new tab)</span></a></p>
      </div>
      <div role="status" className="text-sm text-muted-foreground">
        {resolving ? 'Finding address details for your pin…' : state === 'loading' ? 'Loading map…' : state === 'failed' ? 'The map could not be loaded. Use current location or enter coordinates below.'
          : tileError ? 'Map images could not be loaded. Check your connection, use current location, or enter coordinates.'
          : pin ? 'Pin selected. Check the location, then confirm.' : 'No pin selected yet.'}
      </div>
      {locationError && <p role="alert" className="text-sm text-destructive">{locationError}</p>}
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Enter or check coordinates</summary>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="service-pin-latitude">Latitude</Label><Input id="service-pin-latitude" inputMode="decimal" value={latitude} onChange={(event) => editCoordinate('latitude', event.target.value)} placeholder="e.g. 14.833000" /></div>
          <div className="space-y-2"><Label htmlFor="service-pin-longitude">Longitude</Label><Input id="service-pin-longitude" inputMode="decimal" value={longitude} onChange={(event) => editCoordinate('longitude', event.target.value)} placeholder="e.g. 120.883000" /></div>
        </div>
        {(latitude || longitude) && !pin && <p className="mt-2 text-destructive">Enter a latitude from −90 to 90 and a longitude from −180 to 180.</p>}
        <Button type="button" variant="ghost" className="mt-2" disabled={!pin || state !== 'ready'} onClick={showCoordinates}>Show coordinates on map</Button>
      </details>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" disabled={!pin || locating || resolving} onClick={() => void confirm()}><MapPin aria-hidden="true" />{resolving ? 'Finding address…' : 'Confirm service pin'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
