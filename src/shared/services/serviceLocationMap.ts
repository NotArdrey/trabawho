import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MapPin } from 'lucide-react';
import type { Map, Marker, LeafletMouseEvent } from 'leaflet';
import type { ServicePin } from '@/shared/domain/serviceAddress';

export interface LocationMapController {
  setPin: (pin: ServicePin, center?: boolean) => void;
  selectCenter: () => void;
  zoom: (direction: number) => void;
  resize: () => void;
  destroy: () => void;
}

export async function createServiceLocationMap(element: HTMLElement, initial: ServicePin | undefined,
  onSelect: (pin: ServicePin) => void, onTileError: () => void): Promise<LocationMapController> {
  const L = await import('leaflet');
  const map: Map = L.map(element, { zoomControl: false, attributionControl: false, scrollWheelZoom: false,
    zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, minZoom: 3, maxZoom: 19 });
  map.setView(initial ? [initial.latitude, initial.longitude] : [12.5, 122], initial ? 17 : 6);
  const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, updateWhenIdle: true, keepBuffer: 0,
  }).addTo(map);
  tiles.on('tileerror', onTileError);
  let marker: Marker | undefined;
  const markerElement = document.createElement('span');
  const markerRoot = createRoot(markerElement);
  markerRoot.render(createElement(MapPin, { className: 'size-11 fill-primary text-primary-foreground drop-shadow', 'aria-hidden': true }));
  const icon = L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 42], html: markerElement });
  function setPin(pin: ServicePin, center = false) {
    const point = L.latLng(pin.latitude, pin.longitude);
    if (marker) marker.setLatLng(point);
    else {
      marker = L.marker(point, { icon, draggable: true, keyboard: false, title: 'Selected service location' }).addTo(map);
      marker.on('dragend', () => {
        const location = marker!.getLatLng().wrap();
        onSelect({ latitude: location.lat, longitude: location.lng });
      });
    }
    if (center) map.setView(point, 17, { animate: false });
  }
  map.on('click', (event: LeafletMouseEvent) => {
    const point = event.latlng.wrap();
    const pin = { latitude: point.lat, longitude: point.lng };
    setPin(pin);
    onSelect(pin);
  });
  if (initial) setPin(initial);
  return { setPin, selectCenter: () => {
    const point = map.getCenter().wrap();
    const pin = { latitude: point.lat, longitude: point.lng };
    setPin(pin);
    onSelect(pin);
  }, zoom: (direction) => map.setZoom(map.getZoom() + direction, { animate: false }),
  resize: () => map.invalidateSize(), destroy: () => { map.remove(); queueMicrotask(() => markerRoot.unmount()); } };
}
