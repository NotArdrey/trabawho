export interface RegistrationDetails {
  province: string;
  city: string;
  barangay: string;
  address: string;
  identityVerificationConsent: boolean;
  dataPrivacyConsent: boolean;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};

const cleanString = (value: unknown) => String(value ?? "").trim();

const readConsent = (value: unknown) =>
  value === true || cleanString(value).toLowerCase() === "true";

export function normalizeRegistrationDetails(source: unknown): RegistrationDetails {
  const root = asRecord(source);
  const registration = asRecord(root.registration);
  const location = asRecord(root.serviceLocation ?? root.service_location ?? registration.service_location ?? root);
  const consent = asRecord(root.consent ?? registration.consent ?? root);

  return {
    province: cleanString(location.province),
    city: cleanString(location.cityMunicipality ?? location.city_municipality ?? location.city),
    barangay: cleanString(location.barangay),
    address: cleanString(location.specificAddress ?? location.specific_address ?? location.address),
    identityVerificationConsent: readConsent(
      consent.identityVerificationConsent
      ?? consent.identity_verification_consent
      ?? root.acceptedIdentityTerms,
    ),
    dataPrivacyConsent: readConsent(
      consent.dataPrivacyConsent
      ?? consent.data_privacy_consent
      ?? root.acceptedRaTerms,
    ),
  };
}

export function assertCompleteRegistrationDetails(details: RegistrationDetails) {
  if (!details.province || !details.city || !details.barangay || !details.address) {
    throw new Error("Province, city or municipality, barangay, and specific address are required.");
  }
  if (!details.identityVerificationConsent || !details.dataPrivacyConsent) {
    throw new Error("Identity verification and data privacy consent are required.");
  }
}
