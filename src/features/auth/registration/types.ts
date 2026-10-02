import type { IdentitySignupInput } from '@/shared/services/identity-registration-types';

export interface RegistrationValues extends IdentitySignupInput {
  confirmPassword: string;
  province: string;
  city: string;
  barangay: string;
  address: string;
  manualFullName: string;
  identityDocumentNumber: string;
  idDocumentExpiry: string;
  frontImage: File | null;
  backImage: File | null;
  selfieImage: File | null;
  acceptedIdentityTerms: boolean;
  acceptedRaTerms: boolean;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationValues, string>>;
export type UpdateRegistration = <K extends keyof RegistrationValues>(name: K, value: RegistrationValues[K]) => void;
export interface LocationOption { code: string; name: string }
