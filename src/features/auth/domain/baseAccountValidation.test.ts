import { describe, expect, it } from 'vitest';
import { baseAccountErrors } from './baseAccountValidation';
describe('base account validation', () => {
  it('reports each invalid input without requiring identity, role, or address fields', () => {
    expect(baseAccountErrors({ email: 'invalid', password: 'short', confirmPassword: '', acceptedTerms: false })).toEqual({
      email: 'Enter a valid email address.', password: 'Use a password of 8 to 128 characters.',
      acceptedTerms: 'Accept the Terms and Conditions to create your account.',
      confirmPassword: 'Re-enter your password to confirm it.',
    });
    expect(baseAccountErrors({ email: 'person@example.com', password: 'Password123!', confirmPassword: 'Password123!', acceptedTerms: true })).toEqual({});
  });
  it('does not silently trim a password that the server will use differently', () => {
    expect(baseAccountErrors({ email: 'person@example.com', password: ' Password123!', confirmPassword: ' Password123!', acceptedTerms: true }).password).toContain('Remove spaces');
  });
  it('requires an exact confirmation without trimming or changing case', () => {
    for (const confirmPassword of ['password123!', 'Password123! ', 'different']) {
      expect(baseAccountErrors({ email: 'person@example.com', password: 'Password123!', confirmPassword, acceptedTerms: true }).confirmPassword)
        .toBe('Passwords do not match. Re-enter the same password.');
    }
  });
});
