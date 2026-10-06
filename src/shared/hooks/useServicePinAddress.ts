import { useEffect, useRef, useState } from 'react';
import type { ServiceAddress, ServicePin } from '@/shared/domain/serviceAddress';
import { lookupPinAddress, type PinAddressResult } from '@/shared/services/pinAddressLookup';

export function useServicePinAddress(value: ServiceAddress, pin: ServicePin | null, onConfirm: (result: PinAddressResult) => void) {
  const [pending, setPending] = useState<{ key: string; controller: AbortController } | null>(null);
  const key = pin ? `${pin.latitude},${pin.longitude}` : '';
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, [pin?.latitude, pin?.longitude]);
  async function confirm() {
    if (!pin || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending({ key, controller });
    try {
      const result = await lookupPinAddress(pin, value, controller.signal);
      if (!controller.signal.aborted) onConfirm(result);
    } catch {
      // Cancelling or moving the pin discards the lookup and leaves the form intact.
    } finally {
      if (active.current === controller) active.current = null;
      setPending(current => current?.controller === controller ? null : current);
    }
  }
  return { resolving: pending?.key === key && !pending.controller.signal.aborted, confirm };
}
