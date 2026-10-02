import { describe, expect, it } from 'vitest';
import { validateRegistrationStep, todayInputValue } from './validation';
import type { RegistrationValues } from './types';

const valid: RegistrationValues = {
  email: 'person@example.com', password: 'Password123!', confirmPassword: 'Password123!', accountRole: 'client', documentTypeKey: 'id_card',
  province: 'La Union', city: 'Balaoan', barangay: 'Almeida', address: '12 Main Street', manualFullName: '', identityDocumentNumber: '', idDocumentExpiry: '',
  frontImage: null, backImage: null, selfieImage: null, acceptedIdentityTerms: true, acceptedRaTerms: true,
};

describe('registration validation', () => {
  it('reports each malformed security field and accepts corrected values', () => {
    expect(validateRegistrationStep({ ...valid, email: 'fafaf', password: 'short', confirmPassword: 'other' }, 2)).toEqual({
      email: 'Enter a valid email address.', password: 'Enter at least 8 characters.', confirmPassword: 'Passwords must match.',
    });
    expect(validateRegistrationStep(valid, 2)).toEqual({});
  });
  it('requires every location field, including an address containing more than spaces', () => {
    expect(Object.keys(validateRegistrationStep({ ...valid, province: '', city: '', barangay: '', address: '  ' }, 3))).toEqual(['province', 'city', 'barangay', 'address']);
    expect(validateRegistrationStep(valid, 3)).toEqual({});
  });
  it('rejects unknown account and document selections', () => {
    expect(Object.keys(validateRegistrationStep({ ...valid, accountRole: 'admin', documentTypeKey: 'unknown' }, 1))).toEqual(['accountRole', 'documentTypeKey']);
  });
  it('requires both explicit consents, without requiring manual files for Didit', () => {
    expect(Object.keys(validateRegistrationStep({ ...valid, acceptedIdentityTerms: false, acceptedRaTerms: false }, 4))).toEqual(['acceptedIdentityTerms', 'acceptedRaTerms']);
    expect(validateRegistrationStep(valid, 4)).toEqual({});
  });
  it('checks manual details, expiry and image types', () => {
    const manual = { ...valid, documentTypeKey: 'umid', idDocumentExpiry: '2000-01-01', frontImage: new File(['text'], 'id.txt', { type: 'text/plain' }) };
    expect(Object.keys(validateRegistrationStep(manual, 4))).toEqual(['manualFullName', 'identityDocumentNumber', 'idDocumentExpiry', 'frontImage', 'backImage', 'selfieImage']);
    const image = new File(['image'], 'id.png', { type: 'image/png' });
    expect(validateRegistrationStep({ ...manual, manualFullName: 'Juan Dela Cruz', identityDocumentNumber: '123', idDocumentExpiry: todayInputValue(), frontImage: image, backImage: image, selfieImage: image }, 4)).toEqual({});
  });
  it('uses the local calendar date for expiry rather than a UTC date', () => {
    const local = new Date(2030, 0, 2, 0, 5);
    expect(todayInputValue(local)).toBe('2030-01-02');
  });
  it('catches password normalization, address length, and impossible dates before submission', () => {
    expect(validateRegistrationStep({ ...valid, password: ' Password123!', confirmPassword: ' Password123!' }, 2).password).toContain('Remove spaces');
    expect(validateRegistrationStep({ ...valid, address: 'a'.repeat(501) }, 3).address).toContain('500 characters');
    expect(validateRegistrationStep({ ...valid, documentTypeKey: 'umid', idDocumentExpiry: '2030-02-30' }, 4).idDocumentExpiry).toBe('Enter a valid expiry date.');
  });
});
