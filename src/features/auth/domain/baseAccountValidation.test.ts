import { describe, expect, it } from 'vitest';
import { baseAccountErrors } from './baseAccountValidation';
describe('base account validation', () => {
  it('reports each invalid input without requiring identity, role, or address fields', () => {
    expect(baseAccountErrors({ email: 'invalid', password: 'short', acceptedTerms: false })).toEqual({
      email: 'Enter a valid email address.', password: 'Use a password of 8 to 128 characters.',
      acceptedTerms: 'Accept the Terms and Conditions to create your account.',
    });
    expect(baseAccountErrors({ email: 'person@example.com', password: 'Password123!', acceptedTerms: true })).toEqual({});
  });
  it('does not silently trim a password that the server will use differently', () => {
    expect(baseAccountErrors({ email: 'person@example.com', password: ' Password123!', acceptedTerms: true }).password).toContain('Remove spaces');
  });
});
