import { IDENTITY_DOCUMENT_TYPES, getDocumentType } from '@/shared/services/identityRegistrationService';
import type { RegistrationErrors, RegistrationValues } from './types';

export const REGISTRATION_STEPS = ['Account', 'Security', 'Location', 'Review'] as const;

export function todayInputValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function validateRegistrationStep(values: RegistrationValues, step: number): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (step === 1) {
    if (!['client', 'worker'].includes(values.accountRole)) errors.accountRole = 'Choose an account type.';
    if (!IDENTITY_DOCUMENT_TYPES.some((document) => document.key === values.documentTypeKey)) errors.documentTypeKey = 'Choose an identity document.';
  }
  if (step === 2) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
    if (values.password.length < 8) errors.password = 'Enter at least 8 characters.';
    else if (values.password !== values.password.trim()) errors.password = 'Remove spaces at the beginning or end of your password.';
    if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords must match.';
  }
  if (step === 3) {
    if (!values.province.trim()) errors.province = 'Select a province.';
    if (!values.city.trim()) errors.city = 'Select a city or municipality.';
    if (!values.barangay.trim()) errors.barangay = 'Select a barangay.';
    if (!values.address.trim()) errors.address = 'Enter your house number, street, or specific address.';
    else if (values.address.trim().length > 500) errors.address = 'Use no more than 500 characters for your address.';
  }
  if (step === 4) {
    if (getDocumentType(values.documentTypeKey).mode !== 'didit') {
      if (!values.manualFullName.trim()) errors.manualFullName = 'Enter the full name shown on your ID.';
      if (!values.identityDocumentNumber.trim()) errors.identityDocumentNumber = 'Enter your ID number.';
      if (!values.idDocumentExpiry) errors.idDocumentExpiry = 'Enter the ID expiry date.';
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.idDocumentExpiry) || !Number.isFinite(Date.parse(values.idDocumentExpiry)) || new Date(values.idDocumentExpiry).toISOString().slice(0, 10) !== values.idDocumentExpiry) errors.idDocumentExpiry = 'Enter a valid expiry date.';
      else if (values.idDocumentExpiry < todayInputValue()) errors.idDocumentExpiry = 'Use an ID that has not expired.';
      for (const [field, label] of [['frontImage', 'front ID'], ['backImage', 'back ID'], ['selfieImage', 'selfie']] as const) {
        const file = values[field];
        if (!file) errors[field] = `Upload your ${label} image.`;
        else if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) errors[field] = 'Choose a JPEG, PNG, or WebP image.';
        else if (file.size === 0) errors[field] = 'Choose an image file that is not empty.';
        else if (file.size > 7 * 1024 * 1024) errors[field] = 'Choose an image no larger than 7 MB.';
      }
    }
    if (!values.acceptedIdentityTerms) errors.acceptedIdentityTerms = 'Consent to identity verification to continue.';
    if (!values.acceptedRaTerms) errors.acceptedRaTerms = 'Agree to the Terms and Conditions to continue.';
  }
  return errors;
}
