import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { serviceMapsUrl, type ServiceAddress } from '@/shared/domain/serviceAddress';
import { useAddressSuggestions } from '@/shared/hooks/useAddressSuggestions';
import type { AddressSuggestion } from '@/shared/services/googlePlaces';

export function SpecificAddressField({ value, onChange, disabled, prefix, label = 'Specific service address' }: {
  value: ServiceAddress;
  onChange: (address: string) => void;
  disabled: boolean;
  prefix: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectionError, setSelectionError] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const selectionVersion = useRef(0);
  useEffect(() => () => { selectionVersion.current++; }, []);
  const hasArea = Boolean(value.province && value.city && value.barangay);
  const configured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim());
  const query = value.address.trim().length >= 3 && hasArea
    ? [value.address, value.barangay, value.city, value.province, 'Philippines'].join(', ') : '';
  const suggestions = useAddressSuggestions(query, configured && open && !disabled && !selecting);
  const id = `${prefix}-address`;
  const listId = `${id}-suggestions`;
  const expanded = open && suggestions.options.length > 0;
  const mapsUrl = serviceMapsUrl(value);

  async function selectSuggestion(option: AddressSuggestion) {
    const version = ++selectionVersion.current;
    setSelecting(true);
    setOpen(false);
    setSelectionError(false);
    try {
      const address = await option.resolve();
      if (selectionVersion.current === version) onChange(address);
    } catch {
      if (selectionVersion.current === version) setSelectionError(true);
    } finally {
      if (selectionVersion.current === version) setSelecting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (expanded && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + direction + suggestions.options.length) % suggestions.options.length);
    } else if (expanded && event.key === 'Enter' && suggestions.options[activeIndex]) {
      event.preventDefault();
      void selectSuggestion(suggestions.options[activeIndex]);
    }
  }

  return <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
        aria-controls={listId} aria-activedescendant={expanded && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-describedby={`${id}-help ${id}-status`} autoComplete="off" maxLength={500} required
        placeholder="House/unit number, street, building" value={value.address} disabled={disabled || selecting}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={handleKeyDown}
        onChange={(event) => {
          selectionVersion.current++;
          setActiveIndex(-1);
          setSelectionError(false);
          setOpen(true);
          onChange(event.target.value);
        }} />
      {expanded && <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-1 text-popover-foreground shadow-sm">
        <div id={listId} role="listbox" aria-label="Google Maps address suggestions">
          {suggestions.options.map((option, index) => <button key={option.id} id={`${id}-option-${index}`}
            type="button" role="option" aria-selected={index === activeIndex} tabIndex={-1}
            className={cn('flex min-h-11 w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', index === activeIndex && 'bg-accent')}
            onMouseDown={(event) => event.preventDefault()} onClick={() => void selectSuggestion(option)}>
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 break-words">{option.label}</span>
          </button>)}
        </div>
        <p translate="no" className="whitespace-nowrap px-3 py-2 text-xs font-normal not-italic tracking-normal text-muted-foreground">Google Maps</p>
      </div>}
    </div>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{configured
      ? 'Choose a Google Maps suggestion or type the full address. Include your house or unit number.'
      : 'Include your house or unit number.'}</p>
    <p id={`${id}-status`} role="status" className="text-xs text-muted-foreground">
      {selecting ? 'Loading selected address…' : suggestions.loading ? 'Finding addresses…'
        : suggestions.error || selectionError ? 'Google Maps suggestions are unavailable. You can still type the full address.'
        : configured && open && query && !suggestions.options.length ? 'No matching addresses. You can type the full address.' : ''}
    </p>
    {query && <Button asChild variant="ghost" className="max-w-full px-0 text-primary">
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" />{value.pin ? 'View saved pin on Google Maps' : 'Search address on Google Maps'}<span className="sr-only"> (opens in a new tab)</span></a>
    </Button>}
  </div>;
}
