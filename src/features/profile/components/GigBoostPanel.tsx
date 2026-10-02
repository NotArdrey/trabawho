import { useState } from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/forms";
import { getActiveAdBooster } from "@/shared/utils/serviceBoost";
import { useGigBoost } from "../hooks/useGigBoost";
import { formatBoostDate, validateBoostSettings } from "../utils/gigBoost";
import { BoostActivationDialog } from "./BoostActivationDialog";

export function GigBoostPanel({ sellerId }: { sellerId?: string }) {
  const flow = useGigBoost(sellerId);
  const [touched, setTouched] = useState({ days: false });
  const errors = validateBoostSettings(flow.days);
  const disabled = flow.loading || flow.saving || flow.verifying;
  return (
    <section aria-labelledby="gig-boost-heading" className="mt-6 min-w-0 border-t pt-6">
      <h2 id="gig-boost-heading" className="flex items-center gap-2 text-xl font-bold"><Rocket className="size-5 text-primary" aria-hidden="true" />Ad booster</h2>
      <p className="mt-2 text-sm text-muted-foreground">Boost one of your gigs in marketplace recommendations. Your boost starts after payment is verified.</p>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SelectField label="Gig" id="boost-service" className="min-w-0 content-start" triggerClassName="min-h-11 min-w-0 [&>span]:truncate" value={flow.selectedId} onValueChange={flow.setSelectedId} disabled={disabled || !flow.services.length} placeholder={flow.loading ? "Loading gigs..." : "No active gigs found"} options={flow.services.map((service) => ({ value: String(service.id), label: `${service.title}${getActiveAdBooster(service, flow.clock).isBoosted ? " (Boosted)" : ""}` }))} />
        <div className="grid content-start gap-2"><Label htmlFor="boost-days">Days</Label><Input id="boost-days" type="number" min="1" max="365" step="1" value={flow.days} disabled={disabled} aria-invalid={touched.days && Boolean(errors.days)} aria-describedby="boost-days-hint" onBlur={() => setTouched((value) => ({ ...value, days: true }))} onChange={(event) => flow.setDays(event.target.value)} /><p id="boost-days-hint" className={touched.days && errors.days ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{touched.days && errors.days ? errors.days : "1 to 365 whole days"}</p></div>
        <div className="grid content-start gap-2"><p className="text-sm font-medium">Daily rate</p><p className="flex min-h-11 items-center rounded-md bg-muted px-3 text-sm font-semibold">{flow.pricingError ? "Unavailable" : `PHP ${flow.dailyRate.toLocaleString("en-PH", { maximumFractionDigits: 2 })} per day`}</p><p className="text-xs text-muted-foreground">Fixed rate for each selected day</p></div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Your total is the daily rate multiplied by the number of days, paid once. No additional booking platform fee.</p>
      {flow.boost.boostEndsAt ? <p className="mt-3 text-sm font-semibold">This gig is boosted until {formatBoostDate(flow.boost.boostEndsAt)}.</p> : null}
      {flow.total !== null && <p role="status" className="mt-3 rounded-lg bg-primary/5 p-3 text-sm font-semibold">PHP {flow.total.toLocaleString("en-PH", { maximumFractionDigits: 2 })} total for {Number(flow.days)} {Number(flow.days) === 1 ? "day" : "days"}. Starts after verified payment.</p>}
      {flow.pricingError ? <p role="alert" className="mt-3 text-sm text-destructive">{flow.pricingError}</p> : null}
      <Button type="button" className="mt-4 min-h-11 w-full" onClick={() => { setTouched({ days: true }); flow.review(); }} disabled={disabled || !flow.selectedId || flow.boost.isBoosted || Boolean(flow.pricingError)}>{flow.boost.isBoosted ? "Gig already boosted" : "Review boost payment"}</Button>
      {flow.message ? <p role="status" className="mt-3 rounded-lg border bg-muted p-3 text-sm">{flow.message}</p> : null}
      {flow.error && !flow.draft ? <p role="alert" className="mt-3 text-sm text-destructive">{flow.error}</p> : null}
      {flow.canVerify ? <Button variant="outline" className="mt-3 min-h-11" disabled={flow.verifying} onClick={flow.checkPayment}>Check payment again</Button> : null}
      {flow.error && !flow.services.length ? <Button variant="outline" className="mt-3 min-h-11" disabled={flow.loading} onClick={() => { void flow.retryLoad(); }}>Reload gigs</Button> : null}
      {flow.draft ? <BoostActivationDialog budget={flow.draft.amount} days={flow.draft.days} serviceTitle={flow.draft.serviceTitle} isOpen isSaving={flow.saving} error={flow.error} onCancel={flow.cancel} onConfirm={() => { void flow.checkout(); }} /> : null}
    </section>
  );
}
