import { useEffect, useRef, useState } from 'react';
import { createServiceLocationMap, type LocationMapController } from '@/shared/services/serviceLocationMap';
import type { ServicePin } from '@/shared/domain/serviceAddress';

export function useServiceLocationMap(initial: ServicePin | undefined, onSelect: (pin: ServicePin) => void) {
  const [element, container] = useState<HTMLDivElement | null>(null);
  const controller = useRef<LocationMapController | null>(null);
  const initialPin = useRef(initial);
  const select = useRef(onSelect);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [tileError, setTileError] = useState(false);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!element) return;
    let active = true;
    let observer: ResizeObserver | undefined;
    let map: LocationMapController | undefined;
    void createServiceLocationMap(element, initialPin.current, (pin) => {
      if (active) select.current(pin);
    }, () => { if (active) setTileError(true); }).then((created) => {
      if (!active) { created.destroy(); return; }
      map = created;
      controller.current = created;
      observer = new ResizeObserver(created.resize);
      observer.observe(element);
      setState('ready');
    }).catch(() => { if (active) setState('failed'); });
    return () => { active = false; observer?.disconnect(); map?.destroy(); controller.current = null; };
  }, [element]);
  return { container, controller, state, tileError };
}
