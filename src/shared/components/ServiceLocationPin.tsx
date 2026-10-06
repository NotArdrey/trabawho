import { lazy, Suspense, useRef, useState } from 'react';
import { MapPin, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ServiceAddress } from '@/shared/domain/serviceAddress';

const ServiceLocationPicker = lazy(() => import('./ServiceLocationPicker').then((module) => ({ default: module.ServiceLocationPicker })));

export function ServiceLocationPin({ value, onChange, disabled }: {
  value: ServiceAddress; onChange: (value: ServiceAddress) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const hasArea = Boolean(value.province && value.city && value.barangay);
  return <div className="space-y-2 border-t pt-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button ref={trigger} type="button" variant="outline" disabled={disabled || !hasArea} onClick={() => setOpen(true)}>
        <MapPin aria-hidden="true" />{value.pin ? 'Edit service location pin' : 'Pin service location'}
      </Button>
      {value.pin && <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange({ ...value, pin: undefined })}>Remove pin</Button>}
    </div>
    <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
      {value.pin && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
      {value.pin ? 'Location pin selected. It will be saved with your booking.' : hasArea
        ? 'Add an exact pin to help your provider find the service address.' : 'Select your province, city, and barangay to add a pin.'}
    </p>
    {open && <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Opening map…</p>}>
      <ServiceLocationPicker value={value} onConfirm={(pin) => { onChange({ ...value, pin }); setOpen(false); }}
        onClose={() => setOpen(false)} onRestoreFocus={() => trigger.current?.focus()} />
    </Suspense>}
  </div>;
}
