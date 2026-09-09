import { useState, type FormEvent, type ReactNode } from "react";
import { BriefcaseBusiness, CircleDollarSign, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PricingModel = "fixed" | "hourly" | "daily" | "weekly" | "monthly";
type AfterServicePaymentType = "both" | "cash-only" | "gcash-only";

export interface ServiceProfileDraft {
  afterServicePaymentType?: AfterServicePaymentType;
  dailyRate?: number | null;
  description?: string;
  fixedPrice?: number | null;
  fullName?: string;
  gcashNumber?: string;
  hourlyRate?: number | null;
  monthlyRate?: number | null;
  paymentAdvance?: boolean;
  paymentAfterService?: boolean;
  pricingModel?: PricingModel;
  serviceType?: string;
  weeklyRate?: number | null;
}

export interface ServiceProfileUpdate extends Omit<ServiceProfileDraft, "dailyRate" | "fixedPrice" | "hourlyRate" | "monthlyRate" | "weeklyRate"> {
  dailyRate: number | null;
  fixedPrice: number | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  weeklyRate: number | null;
}

interface ProfileEditModalProps {
  appTheme?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: ServiceProfileUpdate) => void | Promise<unknown>;
  profileData?: ServiceProfileDraft | null;
}

const PRICING_OPTIONS: Array<{ label: string; value: PricingModel }> = [
  { label: "Fixed price", value: "fixed" },
  { label: "Hourly rate", value: "hourly" },
  { label: "Daily rate", value: "daily" },
  { label: "Weekly rate", value: "weekly" },
  { label: "Monthly rate", value: "monthly" },
];

const RATE_FIELDS: Record<PricingModel, { label: string; placeholder: string; step: string }> = {
  fixed: { label: "Fixed price (PHP)", placeholder: "e.g., 500", step: "50" },
  hourly: { label: "Hourly rate (PHP/hour)", placeholder: "e.g., 250", step: "25" },
  daily: { label: "Daily rate (PHP/day)", placeholder: "e.g., 1,500", step: "50" },
  weekly: { label: "Weekly rate (PHP/week)", placeholder: "e.g., 3,000", step: "100" },
  monthly: { label: "Monthly rate (PHP/month)", placeholder: "e.g., 12,000", step: "500" },
};

function FormSection({ children, description, icon: Icon, title, tone }: { children: ReactNode; description: string; icon: typeof BriefcaseBusiness; title: string; tone: "primary" | "highlight" }) {
  return (
    <section className="overflow-hidden rounded-xl bg-muted/30">
      <header className={cn("flex items-center gap-3 px-4 py-3", tone === "highlight" ? "bg-brand-highlight-soft/60" : "bg-primary/5")}>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone === "highlight" ? "bg-brand-highlight-soft text-brand-highlight-foreground" : "bg-primary/10 text-primary")}><Icon className="size-4" aria-hidden="true" /></span>
        <div><h3 className="text-sm font-bold text-foreground">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
      </header>
      <div className="grid gap-4 p-4">{children}</div>
    </section>
  );
}

function RequiredMark() {
  return <span className="text-brand-highlight" aria-hidden="true">*</span>;
}

function ProfileEditForm({ profileData, onClose, onSave }: Omit<ProfileEditModalProps, "appTheme" | "isOpen">) {
  const [serviceType, setServiceType] = useState(profileData?.serviceType || "");
  const [description, setDescription] = useState(profileData?.description || "");
  const [pricingModel, setPricingModel] = useState<PricingModel>(profileData?.pricingModel || "fixed");
  const [rates, setRates] = useState<Record<PricingModel, string>>({
    fixed: String(profileData?.fixedPrice ?? ""),
    hourly: String(profileData?.hourlyRate ?? ""),
    daily: String(profileData?.dailyRate ?? ""),
    weekly: String(profileData?.weeklyRate ?? ""),
    monthly: String(profileData?.monthlyRate ?? ""),
  });
  const [paymentAdvance, setPaymentAdvance] = useState(profileData?.paymentAdvance !== false);
  const [paymentAfterService, setPaymentAfterService] = useState(profileData?.paymentAfterService !== false);
  const [afterServicePaymentType, setAfterServicePaymentType] = useState<AfterServicePaymentType>(profileData?.afterServicePaymentType || "both");
  const [gcashNumber, setGcashNumber] = useState(profileData?.gcashNumber || "");
  const [error, setError] = useState("");

  const rateField = RATE_FIELDS[pricingModel];
  const activeRate = rates[pricingModel];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!serviceType.trim()) return setError("Please enter a service type");
    if (!description.trim()) return setError("Please enter a service description");
    if (!activeRate.trim() || Number(activeRate) <= 0) return setError(`Please enter a valid ${rateField.label.toLowerCase()}`);
    if (!paymentAdvance && !paymentAfterService) return setError("Please select at least one payment method");

    void onSave({
      afterServicePaymentType,
      dailyRate: pricingModel === "daily" ? Number(activeRate) : null,
      description: description.trim(),
      fixedPrice: pricingModel === "fixed" ? Number(activeRate) : null,
      fullName: profileData?.fullName || "",
      gcashNumber: gcashNumber.trim(),
      hourlyRate: pricingModel === "hourly" ? Number(activeRate) : null,
      monthlyRate: pricingModel === "monthly" ? Number(activeRate) : null,
      paymentAdvance,
      paymentAfterService,
      pricingModel,
      serviceType: serviceType.trim(),
      weeklyRate: pricingModel === "weekly" ? Number(activeRate) : null,
    });
  };

  return (
    <form className="contents" onSubmit={handleSubmit}>
      <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
        {error ? <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">{error}</div> : null}
        <div className="grid gap-5">
          <FormSection icon={BriefcaseBusiness} title="Service details" description="What clients see when considering your service." tone="primary">
            <div className="grid gap-2"><Label htmlFor="edit-service-type">Service type <RequiredMark /></Label><Input id="edit-service-type" value={serviceType} onChange={(event) => setServiceType(event.target.value)} placeholder="e.g., Math Tutoring, Laptop Repair" /></div>
            <div className="grid gap-2"><Label htmlFor="edit-description">Service description <RequiredMark /></Label><textarea id="edit-description" className="min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe your service and what you offer..." rows={4} /></div>
          </FormSection>

          <FormSection icon={CircleDollarSign} title="Pricing" description="Choose how clients are charged for this service." tone="highlight">
            <fieldset><legend className="mb-2 text-sm font-semibold text-foreground">Pricing model</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PRICING_OPTIONS.map((option) => <label key={option.value} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors", pricingModel === option.value ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-border text-foreground hover:border-primary/40")}><input className="accent-primary" type="radio" name="pricingModel" value={option.value} checked={pricingModel === option.value} onChange={() => setPricingModel(option.value)} /><span>{option.label}</span></label>)}</div></fieldset>
            <div className="grid gap-2"><Label htmlFor="edit-rate">{rateField.label} <RequiredMark /></Label><Input id="edit-rate" type="number" step={rateField.step} min="0" value={activeRate} onChange={(event) => setRates((current) => ({ ...current, [pricingModel]: event.target.value }))} placeholder={rateField.placeholder} /></div>
          </FormSection>

          <FormSection icon={CreditCard} title="Payment options" description="Set when and how clients can pay you." tone="primary">
            <fieldset><legend className="mb-2 text-sm font-semibold text-foreground">Accepted methods <RequiredMark /></legend><div className="grid gap-2 sm:grid-cols-2"><label className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium", paymentAdvance ? "border-primary bg-primary/5 text-primary" : "border-border")}><input className="accent-primary" type="checkbox" checked={paymentAdvance} onChange={(event) => setPaymentAdvance(event.target.checked)} /><span>GCash advance</span></label><label className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium", paymentAfterService ? "border-primary bg-primary/5 text-primary" : "border-border")}><input className="accent-primary" type="checkbox" checked={paymentAfterService} onChange={(event) => setPaymentAfterService(event.target.checked)} /><span>After service</span></label></div></fieldset>
            {paymentAfterService ? <div className="grid gap-2"><Label htmlFor="edit-after-service-type">After-service payment type</Label><Select value={afterServicePaymentType} onValueChange={(value) => setAfterServicePaymentType(value as AfterServicePaymentType)}><SelectTrigger id="edit-after-service-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Cash or GCash</SelectItem><SelectItem value="cash-only">Cash only</SelectItem><SelectItem value="gcash-only">GCash only</SelectItem></SelectContent></Select></div> : null}
            {paymentAdvance || (paymentAfterService && afterServicePaymentType !== "cash-only") ? <div className="grid gap-2"><Label htmlFor="edit-gcash">GCash number</Label><Input id="edit-gcash" inputMode="numeric" value={gcashNumber} onChange={(event) => setGcashNumber(event.target.value)} placeholder="e.g., 09123456789" /></div> : null}
          </FormSection>
        </div>
      </div>
      <DialogFooter className="border-t border-border bg-background px-4 py-3 sm:px-6"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Save changes</Button></DialogFooter>
    </form>
  );
}

export default function ProfileEditModal({ isOpen, profileData, onSave, onClose }: ProfileEditModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="grid max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[calc(100svh-2rem)]">
        <DialogHeader className="border-b border-border bg-primary/5 px-5 py-5 pr-14 sm:px-6"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><BriefcaseBusiness className="size-[18px]" aria-hidden="true" /></span><div><DialogTitle>Edit service profile</DialogTitle><DialogDescription className="mt-1">Keep your listing, pricing, and payment details accurate.</DialogDescription></div></div></DialogHeader>
        {isOpen ? <ProfileEditForm profileData={profileData} onSave={onSave} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}
