import { useState } from "react";
import { ChevronDown, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";
const BULACAN_CODE = "031400000";

interface LocationOption {
  code: string;
  name: string;
}

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

async function fetchOptions(path: string): Promise<LocationOption[]> {
  const response = await fetch(`${PSGC_BASE_URL}${path}`);
  if (!response.ok) throw new Error("Location service is unavailable.");
  return response.json() as Promise<LocationOption[]>;
}

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
  const initialCity = userLocation?.city || sellerProfile?.city || "";
  const initialBarangay = userLocation?.barangay || sellerProfile?.barangay || "";
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || !collapsible);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [middleName, setMiddleName] = useState(initialName.middleName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [email] = useState(sellerProfile?.email || "");
  const [phone, setPhone] = useState(sellerProfile?.phoneNumber || "");
  const [address, setAddress] = useState(userLocation?.address || sellerProfile?.address || "");
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [barangays, setBarangays] = useState<LocationOption[]>([]);
  const [selectedCityCode, setSelectedCityCode] = useState("");
  const [selectedBarangayCode, setSelectedBarangayCode] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const loadBarangays = async (cityCode: string, expectedBarangay = "") => {
    if (!cityCode) {
      setBarangays([]);
      setSelectedBarangayCode("");
      return;
    }
    const rows = await fetchOptions(`/cities-municipalities/${cityCode}/barangays/`);
    setBarangays(rows);
    const match = rows.find((item) => item.name.toLowerCase() === expectedBarangay.toLowerCase());
    setSelectedBarangayCode(match?.code || "");
  };

  const loadLocations = async () => {
    if (cities.length > 0 || isLoadingLocations) return;
    try {
      setLocationError("");
      setIsLoadingLocations(true);
      const rows = await fetchOptions(`/provinces/${BULACAN_CODE}/cities-municipalities/`);
      setCities(rows);
      const city = rows.find((item) => item.name.toLowerCase() === initialCity.toLowerCase());
      if (city) {
        setSelectedCityCode(city.code);
        await loadBarangays(city.code, initialBarangay);
      }
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Could not load location options.");
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const toggleExpanded = () => {
    if (!collapsible) return;
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) void loadLocations();
  };

  const handleCityChange = async (cityCode: string) => {
    setSelectedCityCode(cityCode);
    setSelectedBarangayCode("");
    try {
      setLocationError("");
      await loadBarangays(cityCode);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Could not load barangays.");
    }
  };

  const savePersonalInfo = async () => {
    if (!firstName.trim() || !lastName.trim()) return setLocationError("First and last name are required.");
    if (!phone.trim() || !address.trim()) return setLocationError("Phone and street address are required.");
    if (!onUpdateProfile) return setLocationError("Profile updates are unavailable right now.");
    const city = cities.find((item) => item.code === selectedCityCode)?.name || initialCity;
    const barangay = barangays.find((item) => item.code === selectedBarangayCode)?.name || initialBarangay;
    try {
      setLocationError("");
      setIsSavingProfile(true);
      await onUpdateProfile({ firstName, middleName, lastName, fullName: [firstName, middleName, lastName].filter(Boolean).join(" "), phoneNumber: phone, province: userLocation?.province || sellerProfile?.province || "Bulacan", city, barangay, address });
      toast.success("Personal information saved.");
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Unable to save personal information.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) return setPasswordError("Complete all password fields.");
    if (newPassword !== confirmNewPassword) return setPasswordError("New passwords do not match.");
    if (newPassword.length < 8) return setPasswordError("New password must contain at least eight characters.");
    if (!onUpdatePassword) return setPasswordError("Password updates are unavailable right now.");
    try {
      setPasswordError("");
      setIsSavingPassword(true);
      await onUpdatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
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
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ShieldCheck className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><strong id="account-privacy-title" className="block text-sm">Account & privacy</strong><span className="mt-1 block text-xs text-muted-foreground">Personal information, location, and password</span></span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} aria-hidden="true" />
        </button>
      ) : <div className="mb-6"><h1 id="account-privacy-title" className="text-2xl font-bold">Account & privacy</h1><p className="mt-1 text-sm text-muted-foreground">Manage private account details and security.</p></div>}

      {isExpanded ? <div id="account-privacy-content" className={cn("space-y-7", collapsible && "pt-5")}>
        <Separator />
        <section aria-labelledby="personal-info-title">
          <div className="mb-4 flex items-start gap-3"><UserRound className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><h2 id="personal-info-title" className="font-semibold">Personal information</h2><p className="text-sm text-muted-foreground">Used for your account, bookings, and service location.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="account-first-name">First name</Label><Input id="account-first-name" value={firstName} autoComplete="given-name" onChange={(event) => setFirstName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="account-middle-name">Middle name <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="account-middle-name" value={middleName} autoComplete="additional-name" onChange={(event) => setMiddleName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="account-last-name">Last name</Label><Input id="account-last-name" value={lastName} autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="account-email">Login email</Label><Input id="account-email" type="email" value={email} readOnly className="bg-muted/50" /><p className="text-xs text-muted-foreground">Email changes are managed through authentication.</p></div>
            <div className="space-y-2"><Label htmlFor="account-phone">Phone</Label><Input id="account-phone" type="tel" value={phone} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="account-address">Street address</Label><Input id="account-address" value={address} autoComplete="street-address" onChange={(event) => setAddress(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="account-city">City or municipality</Label><Select value={selectedCityCode} onOpenChange={(open) => { if (open) void loadLocations(); }} onValueChange={(value) => void handleCityChange(value)} disabled={isLoadingLocations}><SelectTrigger id="account-city"><SelectValue placeholder={isLoadingLocations ? "Loading cities…" : initialCity || "Select city"} /></SelectTrigger><SelectContent>{cities.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="account-barangay">Barangay</Label><Select value={selectedBarangayCode} onValueChange={setSelectedBarangayCode} disabled={!selectedCityCode}><SelectTrigger id="account-barangay"><SelectValue placeholder={selectedCityCode ? initialBarangay || "Select barangay" : "Select a city first"} /></SelectTrigger><SelectContent>{barangays.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {locationError ? <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{locationError}</p> : null}
          <div className="mt-4 flex justify-end"><Button type="button" onClick={() => void savePersonalInfo()} isLoading={isSavingProfile}>{isSavingProfile ? "Saving…" : "Save personal information"}</Button></div>
        </section>

        <Separator />

        <section aria-labelledby="password-title">
          <div className="mb-4 flex items-start gap-3"><LockKeyhole className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><h2 id="password-title" className="font-semibold">Password</h2><p className="text-sm text-muted-foreground">Use at least eight characters and avoid reusing passwords.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" value={currentPassword} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" value={newPassword} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" value={confirmNewPassword} autoComplete="new-password" onChange={(event) => setConfirmNewPassword(event.target.value)} /></div>
          </div>
          {passwordError ? <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{passwordError}</p> : null}
          <div className="mt-4 flex justify-end"><Button type="button" onClick={() => void updatePassword()} isLoading={isSavingPassword}>{isSavingPassword ? "Updating…" : "Update password"}</Button></div>
        </section>
      </div> : null}
    </section>
  );
}

export default AccountPrivacyPanel;
