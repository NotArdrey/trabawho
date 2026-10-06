import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LocationAddressFields } from "@/shared/components/LocationAddressFields";
import { emptyServiceAddress, serviceAddressValid, type ServiceAddress } from "@/shared/domain/serviceAddress";

export interface AccountProfileDetails {
  address?: string;
  barangay?: string;
  city?: string;
  email?: string;
  firstName?: string;
  fullName?: string;
  lastName?: string;
  middleName?: string;
  phoneNumber?: string;
  province?: string;
  userId?: string;
}

export interface AccountLocationDetails {
  address?: string;
  barangay?: string;
  city?: string;
  province?: string;
}

interface AccountPrivacyPanelProps {
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onUpdatePassword?: (values: { currentPassword: string; newPassword: string }) => Promise<unknown>;
  onUpdateProfile?: (values: Record<string, unknown>) => Promise<unknown>;
  sellerProfile?: AccountProfileDetails | null;
  userLocation?: AccountLocationDetails | null;
}

const splitNameParts = (value = "") => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts.at(-1) || "" };
};

function AccountPrivacyPanel({
  collapsible = true,
  defaultExpanded = false,
  onUpdatePassword,
  onUpdateProfile,
  sellerProfile,
  userLocation,
}: AccountPrivacyPanelProps) {
  const initialName = sellerProfile?.firstName || sellerProfile?.lastName
    ? { firstName: sellerProfile.firstName || "", middleName: sellerProfile.middleName || "", lastName: sellerProfile.lastName || "" }
    : splitNameParts(sellerProfile?.fullName || "");
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || !collapsible);
  const editedContactRef = useRef(false);
  const [phone, setPhone] = useState(sellerProfile?.phoneNumber || "");
  const [location, setLocation] = useState<ServiceAddress>(() => ({
    ...emptyServiceAddress,
    province: userLocation?.province || sellerProfile?.province || "",
    city: userLocation?.city || sellerProfile?.city || "",
    barangay: userLocation?.barangay || sellerProfile?.barangay || "",
    address: userLocation?.address || sellerProfile?.address || "",
  }));
  const [locationError, setLocationError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (editedContactRef.current) return;
    setPhone(sellerProfile?.phoneNumber || "");
    setLocation({
      province: userLocation?.province || sellerProfile?.province || "",
      city: userLocation?.city || sellerProfile?.city || "",
      barangay: userLocation?.barangay || sellerProfile?.barangay || "",
      address: userLocation?.address || sellerProfile?.address || "",
    });
  }, [sellerProfile?.phoneNumber, sellerProfile?.province, sellerProfile?.city, sellerProfile?.barangay, sellerProfile?.address,
    userLocation?.province, userLocation?.city, userLocation?.barangay, userLocation?.address]);

  const toggleExpanded = () => {
    if (!collapsible) return;
    const next = !isExpanded;
    setIsExpanded(next);
  };

  const savePersonalInfo = async () => {
    if (!phone.trim() || !serviceAddressValid(location)) return setLocationError("Enter your phone, province, city, barangay, and street address.");
    if (!onUpdateProfile) return setLocationError("Profile updates are unavailable right now.");
    try {
      setLocationError("");
      setIsSavingProfile(true);
      await onUpdateProfile({ phoneNumber: phone.trim(), ...location });
      toast.success("Contact and location saved.");
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Unable to save personal information.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const readPassword = (field: string) => {
      const value = values.get(field);
      return typeof value === "string" ? value : "";
    };
    const currentPassword = readPassword("currentPassword");
    const newPassword = readPassword("newPassword");
    const confirmNewPassword = readPassword("confirmNewPassword");
    if (!currentPassword || !newPassword || !confirmNewPassword) return setPasswordError("Complete all password fields.");
    if (newPassword !== confirmNewPassword) return setPasswordError("New passwords do not match.");
    if (newPassword.length < 8) return setPasswordError("New password must contain at least eight characters.");
    if (!onUpdatePassword) return setPasswordError("Password updates are unavailable right now.");
    try {
      setPasswordError("");
      setIsSavingPassword(true);
      await onUpdatePassword({ currentPassword, newPassword });
      form.reset();
      toast.success("Password updated.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <section className="account-privacy-panel" aria-labelledby="account-privacy-title">
      {collapsible ? (
        <button type="button" className="flex min-h-16 w-full items-center gap-3 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={isExpanded} aria-controls="account-privacy-content" onClick={toggleExpanded}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><strong id="account-privacy-title" className="block text-sm">Account & privacy</strong><span className="mt-1 block text-xs text-muted-foreground">Personal information, location, and password</span></span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} aria-hidden="true" />
        </button>
      ) : <div className="mb-6"><h1 id="account-privacy-title" className="text-2xl font-bold">Account & privacy</h1><p className="mt-1 text-sm text-muted-foreground">Manage private account details and security.</p></div>}

      {isExpanded ? <div id="account-privacy-content" className={cn("space-y-7", collapsible && "pt-5")}>
        <Separator />
        <section aria-labelledby="personal-info-title">
          <div className="mb-4 flex items-start gap-3"><UserRound className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><h2 id="personal-info-title" className="font-semibold">Personal information</h2><p className="text-sm text-muted-foreground">Your account name is protected; contact and location can be updated.</p></div></div>
          <p id="account-name-help" className="mb-4 rounded-lg bg-primary/5 px-3 py-2 text-sm text-muted-foreground">Name changes require a separate identity review. Contact support if your name needs correction.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {([["First name", initialName.firstName], ["Middle name", initialName.middleName], ["Last name", initialName.lastName], ["Login email", sellerProfile?.email || ""]] as const).map(([label, value]) => <div key={label} className="space-y-2">
              <p className="text-sm font-medium">{label}</p>
              <p aria-label={label} aria-describedby={label === "Login email" ? "account-email-help" : "account-name-help"} className="flex min-h-11 items-center gap-2 break-all rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />{value || "Not provided"}
              </p>
              {label === "Login email" && <p id="account-email-help" className="text-xs text-muted-foreground">Your login email cannot be changed here.</p>}
            </div>)}
            <div className="space-y-2"><Label htmlFor="account-phone">Phone</Label><Input id="account-phone" type="tel" value={phone} autoComplete="tel" onChange={(event) => { editedContactRef.current = true; setPhone(event.target.value); }} /></div>
          </div>
          <div className="mt-5"><LocationAddressFields value={location} onChange={(next) => { editedContactRef.current = true; setLocation(next); }} disabled={isSavingProfile} prefix="account" legend="Saved location" description="Used to fill new booking addresses. You can choose a different service address at checkout." addressLabel="Street address" /></div>
          {locationError ? <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{locationError}</p> : null}
          <div className="mt-4 flex justify-end"><Button type="button" onClick={() => void savePersonalInfo()} isLoading={isSavingProfile}>{isSavingProfile ? "Saving…" : "Save contact and location"}</Button></div>
        </section>

        <Separator />

        <section aria-labelledby="password-title">
          <div className="mb-4 flex items-start gap-3"><LockKeyhole className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><h2 id="password-title" className="font-semibold">Password</h2><p className="text-sm text-muted-foreground">Use at least eight characters and avoid reusing passwords.</p></div></div>
          <form onSubmit={(event) => void updatePassword(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" /></div>
              <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" name="newPassword" type="password" autoComplete="new-password" /></div>
              <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" name="confirmNewPassword" type="password" autoComplete="new-password" /></div>
            </div>
            {passwordError ? <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{passwordError}</p> : null}
            <div className="mt-4 flex justify-end"><Button type="submit" isLoading={isSavingPassword} disabled={isSavingPassword}>{isSavingPassword ? "Updating…" : "Update password"}</Button></div>
          </form>
        </section>
      </div> : null}
    </section>
  );
}

export default AccountPrivacyPanel;
