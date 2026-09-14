import { AlertCircle, MapPin, RefreshCw } from "lucide-react";

import { SelectField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  RegistrationErrors,
  RegistrationFormValues,
  RegistrationLocationState,
} from "@/features/auth/types";
import { cn } from "@/lib/utils";

interface RegistrationLocationStepProps {
  values: RegistrationFormValues;
  errors: RegistrationErrors;
  location: RegistrationLocationState;
  onProvinceChange: (code: string) => void;
  onCityChange: (code: string) => void;
  onBarangayChange: (code: string) => void;
  onAddressChange: (value: string) => void;
  onRetry: () => void;
}

export function RegistrationLocationStep({
  values,
  errors,
  location,
  onProvinceChange,
  onCityChange,
  onBarangayChange,
  onAddressChange,
  onRetry,
}: RegistrationLocationStepProps) {
  return (
    <section aria-labelledby="registration-step-heading" className="grid gap-5">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-orange)]">Step 3</p>
        <h2 id="registration-step-heading" tabIndex={-1} className="text-2xl font-bold tracking-tight">Add your service location</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your selections load in order so TrabaWho can match services to the correct area.</p>
      </div>

      {location.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="min-w-0 flex-1">{location.error}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" /> Retry
          </Button>
        </div>
      ) : null}

      <SelectField
        id="province"
        name="province"
        label="Province"
        value={location.selectedProvinceCode}
        onValueChange={onProvinceChange}
        options={location.provinces.map((option) => ({ value: option.code, label: option.name }))}
        placeholder={location.loadingLevel === "province" ? "Loading provinces…" : "Select a province"}
        error={errors.province}
        disabled={location.loadingLevel === "province"}
        required
      />

      <SelectField
        id="city"
        name="city"
        label="City or municipality"
        value={location.selectedCityCode}
        onValueChange={onCityChange}
        options={location.cities.map((option) => ({ value: option.code, label: option.name }))}
        placeholder={!location.selectedProvinceCode
          ? "Select a province first"
          : location.loadingLevel === "city" ? "Loading cities and municipalities…" : "Select a city or municipality"}
        error={errors.city}
        disabled={!location.selectedProvinceCode || location.loadingLevel === "city"}
        required
      />

      <SelectField
        id="barangay"
        name="barangay"
        label="Barangay"
        value={location.selectedBarangayCode}
        onValueChange={onBarangayChange}
        options={location.barangays.map((option) => ({ value: option.code, label: option.name }))}
        placeholder={!location.selectedCityCode
          ? "Select a city or municipality first"
          : location.loadingLevel === "barangay" ? "Loading barangays…" : "Select a barangay"}
        error={errors.barangay}
        disabled={!location.selectedCityCode || location.loadingLevel === "barangay"}
        required
      />

      <div className="grid gap-2">
        <Label htmlFor="specific-address">Specific address</Label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="specific-address"
            name="address"
            type="text"
            value={values.address}
            onChange={(event) => onAddressChange(event.target.value)}
            autoComplete="street-address"
            placeholder="House or unit number, building, and street"
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? "specific-address-error" : "specific-address-description"}
            className={cn("pl-10", errors.address && "border-destructive")}
          />
        </div>
        <p id="specific-address-description" className="text-sm text-muted-foreground">This is stored with your service location and is not shown in the public registration summary.</p>
        {errors.address ? <p id="specific-address-error" role="alert" className="text-sm font-medium text-destructive">{errors.address}</p> : null}
      </div>
    </section>
  );
}
