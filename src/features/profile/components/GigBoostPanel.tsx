import { CircleAlert, CircleCheck, Info, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/forms";
import { getActiveAdBooster } from "@/shared/utils/serviceBoost";
import { useGigBoost } from "../hooks/useGigBoost";
import { BOOST_DURATION_OPTIONS, formatBoostDate } from "../utils/gigBoost";
import { BoostActivationDialog } from "./BoostActivationDialog";

export function GigBoostPanel({ sellerId }: { sellerId?: string }) {
  const flow = useGigBoost(sellerId);
  const disabled = flow.loading || flow.saving || flow.verifying;
  return (
    <section aria-labelledby="gig-boost-heading" className="mt-6 min-w-0 border-t pt-6">
      <h2 id="gig-boost-heading" className="flex items-center gap-2 text-xl font-bold"><Rocket className="size-5 text-primary" aria-hidden="true" />Ad booster</h2>
      <p className="mt-2 text-sm text-muted-foreground">Boost one of your gigs in marketplace recommendations. Your boost starts after payment is verified.</p>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SelectField label="Gig" id="boost-service" className="min-w-0 content-start grid-rows-[1rem_2.75rem]" triggerClassName="min-w-0 [&>span]:truncate" value={flow.selectedId} onValueChange={flow.setSelectedId} disabled={disabled || !flow.services.length} placeholder={flow.loading ? "Loading gigs..." : "No active gigs found"} options={flow.services.map((service) => ({ value: String(service.id), label: `${service.title}${getActiveAdBooster(service, flow.clock).isBoosted ? " (Boosted)" : ""}` }))} />
        <SelectField label="Boost duration" id="boost-days" className="min-w-0 content-start grid-rows-[1rem_2.75rem]" value={flow.days} onValueChange={flow.setDays} disabled={disabled} options={BOOST_DURATION_OPTIONS.map((days) => ({ value: String(days), label: `${days} days` }))} />
        <div className="grid min-w-0 content-start grid-rows-[1rem_2.75rem] gap-2 md:col-span-2 lg:col-span-1"><span className="text-sm font-medium leading-none">Price per day</span><p className="flex min-h-11 items-center rounded-lg border border-border bg-muted/50 px-3 text-sm font-semibold text-foreground">{flow.pricingError ? "Unavailable" : `PHP ${flow.dailyRate.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`}</p></div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Pay once for the selected duration. No additional booking platform fee.</p>
      {flow.boost.boostEndsAt ? <p className="mt-3 text-sm font-semibold">This gig is boosted until {formatBoostDate(flow.boost.boostEndsAt)}.</p> : null}
      {flow.total !== null && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><span className="font-medium text-foreground">Total price · {flow.days} days</span><span className="font-bold text-primary">PHP {flow.total.toLocaleString("en-PH", { maximumFractionDigits: 2 })}</span><span className="w-full text-xs text-muted-foreground">Boost starts after verified payment.</span></div>}
      {flow.pricingError ? <p role="alert" className="mt-3 text-sm text-destructive">{flow.pricingError}</p> : null}
      <Button type="button" className="mt-4 min-h-11 w-full" onClick={flow.review} disabled={disabled || !flow.selectedId || flow.boost.isBoosted || Boolean(flow.pricingError)}>{flow.boost.isBoosted ? "Gig already boosted" : "Review boost payment"}</Button>
      {flow.message ? <div role="status" className={`mt-3 flex items-start gap-3 rounded-lg border p-3 text-sm ${flow.messageKind === "warning" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" : flow.messageKind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100" : "border-primary/20 bg-primary/5 text-foreground"}`}>
        {flow.messageKind === "warning" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : flow.messageKind === "success" ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
        <span>{flow.message}</span>
      </div> : null}
      {flow.error && !flow.draft ? <p role="alert" className="mt-3 text-sm text-destructive">{flow.error}</p> : null}
      {flow.error && !flow.services.length ? <Button variant="outline" className="mt-3 min-h-11" disabled={flow.loading} onClick={() => { void flow.retryLoad(); }}>Reload gigs</Button> : null}
      {flow.draft ? <BoostActivationDialog totalPrice={flow.draft.amount} days={flow.draft.days} serviceTitle={flow.draft.serviceTitle} isOpen isSaving={flow.saving} error={flow.error} onCancel={flow.cancel} onConfirm={() => { void flow.checkout(); }} onTestConfirm={() => { void flow.checkout(true); }} /> : null}
    </section>
  );
}
