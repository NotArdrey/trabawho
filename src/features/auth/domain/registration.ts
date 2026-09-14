import type {
  IdentityDocumentOption,
  RegistrationErrors,
  RegistrationFormValues,
  RegistrationStep,
} from "@/features/auth/types";

export const REGISTRATION_STEPS = [
  { number: 1, label: "Account" },
  { number: 2, label: "Security" },
  { number: 3, label: "Service location" },
  { number: 4, label: "Review" },
] as const satisfies ReadonlyArray<{ number: RegistrationStep; label: string }>;

export const IDENTITY_DOCUMENTS = [
  { key: "id_card", label: "National ID / ID card", method: "DIDIT" },
  { key: "passport", label: "Passport", method: "DIDIT" },
  { key: "drivers_license", label: "Driver's license", method: "DIDIT" },
  { key: "umid", label: "UMID", method: "MANUAL" },
  { key: "postal_id", label: "Postal ID", method: "MANUAL" },
  { key: "voter_id", label: "Voter's ID", method: "MANUAL" },
  { key: "prc_id", label: "PRC ID", method: "MANUAL" },
  { key: "health_insurance", label: "Health insurance ID", method: "MANUAL" },
  { key: "custom_document", label: "Other government document", method: "MANUAL" },
] as const satisfies ReadonlyArray<IdentityDocumentOption>;

export const EMPTY_REGISTRATION_FORM: RegistrationFormValues = {
  accountRole: "",
  documentTypeKey: "",
  email: "",
  password: "",
  confirmPassword: "",
  province: "",
  city: "",
  barangay: "",
  address: "",
  acceptedIdentityTerms: false,
  acceptedRaTerms: false,
  manualFullName: "",
  identityDocumentNumber: "",
  idDocumentExpiry: "",
  frontImage: null,
  backImage: null,
  selfieImage: null,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IDENTITY_IMAGE_BYTES = 7 * 1024 * 1024;

export function getIdentityDocument(key: string): IdentityDocumentOption | null {
  return IDENTITY_DOCUMENTS.find((document) => document.key === key) ?? null;
}

export function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function validateRegistrationStep(
  values: RegistrationFormValues,
  step: RegistrationStep,
): RegistrationErrors {
  const errors: RegistrationErrors = {};

  if (step === 1) {
    if (!values.accountRole) errors.accountRole = "Choose Client or Worker.";
    if (!values.documentTypeKey) errors.documentTypeKey = "Choose an identity document.";
  }

  if (step === 2) {
    if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";
    if (values.password.length < 8) {
      errors.password = "Use at least 8 characters.";
    } else if (!/[A-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      errors.password = "Include at least one uppercase letter and one number.";
    }
    if (!values.confirmPassword) {
      errors.confirmPassword = "Re-enter your password.";
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  if (step === 3) {
    if (!values.province) errors.province = "Select a province.";
    if (!values.city) errors.city = "Select a city or municipality.";
    if (!values.barangay) errors.barangay = "Select a barangay.";
    if (!values.address.trim()) errors.address = "Enter your specific service address.";
  }

  if (step === 4) {
    if (!values.acceptedIdentityTerms) {
      errors.acceptedIdentityTerms = "Consent to identity verification to continue.";
    }
    if (!values.acceptedRaTerms) {
      errors.acceptedRaTerms = "Accept the RA 10173 Terms and Conditions to continue.";
    }
  }

  return errors;
}

function validateIdentityImage(file: File | null, label: string): string | undefined {
  if (!file) return `Upload the ${label} image.`;
  if (!file.type.startsWith("image/")) return `Choose an image file for the ${label}.`;
  if (file.size > MAX_IDENTITY_IMAGE_BYTES) return `${label} image must be 7 MB or smaller.`;
  return undefined;
}

export function validateManualIdentity(values: RegistrationFormValues): RegistrationErrors {
  const errors: RegistrationErrors = {};

  if (!values.manualFullName.trim()) {
    errors.manualFullName = "Enter the name exactly as shown on the ID.";
  }
  if (!values.identityDocumentNumber.trim()) {
    errors.identityDocumentNumber = "Enter the ID number.";
  }
  if (!values.idDocumentExpiry) {
    errors.idDocumentExpiry = "Enter the ID expiry date.";
  } else if (values.idDocumentExpiry < getTodayInputValue()) {
    errors.idDocumentExpiry = "Use an expiry date that is today or later.";
  }

  errors.frontImage = validateIdentityImage(values.frontImage, "front");
  errors.backImage = validateIdentityImage(values.backImage, "back");
  errors.selfieImage = validateIdentityImage(values.selfieImage, "selfie");

  return Object.fromEntries(
    Object.entries(errors).filter(([, value]) => Boolean(value)),
  );
}

export function hasRegistrationErrors(errors: RegistrationErrors): boolean {
  return Object.keys(errors).length > 0;
}
