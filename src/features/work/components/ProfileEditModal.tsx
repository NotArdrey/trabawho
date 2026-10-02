import { useState } from "react";
import CreateServiceModal, { type NewServiceDraft } from "./CreateServiceModal";
import { ServicePaymentFields } from "./ServicePaymentFields";
import { serviceProfileToDraft, serviceDraftToProfileUpdate } from "../utils/serviceDraft";
import type { ServiceRow } from "../utils/serviceDraft";

type PricingModel = "fixed" | "hourly" | "daily" | "weekly" | "monthly" | "package" | "inquiry";
type AfterServicePaymentType = "both" | "cash-only" | "gcash-only";

export interface ServiceProfileDraft {
  raw?: ServiceRow | null;
  rateBasis?: string;
  bookingMode?: string;
  shortDescription?: string;
  durationMinutes?: string | number;
  priceType?: string;
  basePrice?: string | number;
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

function EditServiceForm({ profileData, onSave, onClose }: Omit<ProfileEditModalProps, "isOpen" | "appTheme">) {
  // Keep the form tied to the listing opened, even if a live update changes the selection.
  const [originalProfile] = useState(profileData);
  const [draft, setDraft] = useState<NewServiceDraft>(() => serviceProfileToDraft(originalProfile));
  const [payment, setPayment] = useState<ServiceProfileUpdate>(() => ({
    dailyRate: null, fixedPrice: null, hourlyRate: null, monthlyRate: null, weeklyRate: null,
    paymentAdvance: profileData?.paymentAdvance ?? false,
    paymentAfterService: profileData?.paymentAfterService ?? true,
    afterServicePaymentType: profileData?.afterServicePaymentType || "both",
    gcashNumber: profileData?.gcashNumber || "",
  }));
  return <CreateServiceModal isOpen mode="edit" newService={draft}
    onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
    onClose={onClose}
    bookingExtras={<ServicePaymentFields value={payment} onChange={setPayment} />}
    validateBooking={() => !payment.paymentAdvance && !payment.paymentAfterService ? "Select at least one payment method before continuing." : null}
    onSubmit={() => onSave({ ...payment, ...serviceDraftToProfileUpdate(draft), raw: originalProfile?.raw, fullName: originalProfile?.fullName || "" })} />;
}

export default function ProfileEditModal({ isOpen, ...props }: ProfileEditModalProps) {
  return isOpen ? <EditServiceForm {...props} /> : null;
}
