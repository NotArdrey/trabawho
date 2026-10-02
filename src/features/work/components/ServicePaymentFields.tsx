import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ServiceProfileUpdate } from "./ProfileEditModal";

function RequiredMark() { return <span className="text-destructive" aria-hidden="true">*</span>; }

export function ServicePaymentFields({ value, onChange }: { value: ServiceProfileUpdate; onChange: (next: ServiceProfileUpdate) => void }) {
  const { paymentAdvance, paymentAfterService, afterServicePaymentType, gcashNumber } = value;
  const setPaymentAdvance = (next: boolean) => onChange({ ...value, paymentAdvance: next });
  const setPaymentAfterService = (next: boolean) => onChange({ ...value, paymentAfterService: next });
  const setAfterServicePaymentType = (next: ServiceProfileUpdate["afterServicePaymentType"]) => onChange({ ...value, afterServicePaymentType: next });
  const setGcashNumber = (next: string) => onChange({ ...value, gcashNumber: next });
  return (
          <section className="grid gap-4" aria-labelledby="payment-options-title"><div><h3 id="payment-options-title" className="font-semibold">Payment options</h3><p className="text-sm text-muted-foreground">These payment preferences apply to all your services.</p></div>
            <fieldset><legend className="mb-2 text-sm font-semibold text-foreground">Accepted methods <RequiredMark /></legend><div className="grid gap-2 sm:grid-cols-2"><label className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium", paymentAdvance ? "border-primary bg-primary/5 text-primary" : "border-border")}><input className="accent-primary" type="checkbox" checked={paymentAdvance} onChange={(event) => setPaymentAdvance(event.target.checked)} /><span>GCash advance</span></label><label className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium", paymentAfterService ? "border-primary bg-primary/5 text-primary" : "border-border")}><input className="accent-primary" type="checkbox" checked={paymentAfterService} onChange={(event) => setPaymentAfterService(event.target.checked)} /><span>After service</span></label></div></fieldset>
            {paymentAfterService ? <div className="grid gap-2"><Label htmlFor="edit-after-service-type">After-service payment type</Label><Select value={afterServicePaymentType} onValueChange={(value) => setAfterServicePaymentType(value as ServiceProfileUpdate["afterServicePaymentType"])}><SelectTrigger id="edit-after-service-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Cash or GCash</SelectItem><SelectItem value="cash-only">Cash only</SelectItem><SelectItem value="gcash-only">GCash only</SelectItem></SelectContent></Select></div> : null}
            {paymentAdvance || (paymentAfterService && afterServicePaymentType !== "cash-only") ? <div className="grid gap-2"><Label htmlFor="edit-gcash">GCash number</Label><Input id="edit-gcash" inputMode="numeric" value={gcashNumber} onChange={(event) => setGcashNumber(event.target.value)} placeholder="e.g., 09123456789" /></div> : null}
          </section>
  );
}
