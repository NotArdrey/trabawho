export type AccountType = "client" | "worker";

export type VerificationMethod = "DIDIT" | "MANUAL";

export type RegistrationStep = 1 | 2 | 3 | 4;

export type RegistrationPhase = "form" | "manual" | "didit" | "outcome";

export type RegistrationOutcomeKind = "approved" | "pending" | "failed";

export interface IdentityDocumentOption {
  key: string;
  label: string;
  method: VerificationMethod;
}

export interface RegistrationFormValues {
  accountRole: AccountType | "";
  documentTypeKey: string;
  email: string;
  password: string;
  confirmPassword: string;
  province: string;
  city: string;
  barangay: string;
  address: string;
  acceptedIdentityTerms: boolean;
  acceptedRaTerms: boolean;
  manualFullName: string;
  identityDocumentNumber: string;
  idDocumentExpiry: string;
  frontImage: File | null;
  backImage: File | null;
  selfieImage: File | null;
}

export type RegistrationField = keyof RegistrationFormValues;

export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

export interface LocationOption {
  code: string;
  name: string;
}

export interface RegistrationLocationState {
  provinces: LocationOption[];
  cities: LocationOption[];
  barangays: LocationOption[];
  selectedProvinceCode: string;
  selectedCityCode: string;
  selectedBarangayCode: string;
  loadingLevel: "province" | "city" | "barangay" | null;
  error: string;
}

export interface IdentitySignupSession {
  diditSessionId: string;
  verificationUrl: string;
  email: string;
  password: string;
  appRole: AccountType;
  documentTypeKey: string;
  province?: string;
  city?: string;
  barangay?: string;
  address?: string;
  acceptedIdentityTerms?: boolean;
  acceptedRaTerms?: boolean;
  [key: string]: unknown;
}

export interface IdentitySignupResult {
  identityStatus?: string;
  message?: string;
}

export interface RegistrationOutcome {
  kind: RegistrationOutcomeKind;
  title: string;
  message: string;
}
