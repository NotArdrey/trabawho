import { describe, expect, it } from 'vitest';
import { registrationProgress } from './registrationProgress';

describe('registration progress', () => {
  it('requires email verification before the identity step', () => {
    expect(registrationProgress(null)).toBe(1);
    expect(registrationProgress({ state: 'identity_pending', signupName: '' })).toBe(3);
    expect(registrationProgress({ state: 'identity_pending', signupName: 'Maria Santos' })).toBe(3);
    expect(registrationProgress({ state: 'email_pending' })).toBe(2);
    expect(registrationProgress({ state: 'email_pending', signupName: 'Maria Santos' })).toBe(2);
    expect(registrationProgress({ state: 'identity_in_progress' })).toBe(3);
    expect(registrationProgress({ state: 'declined' })).toBe(3);
    expect(registrationProgress({ state: 'name_pending' })).toBe(3);
  });
  it('shows administrator review after identity submission', () => {
    expect(registrationProgress({ state: 'identity_review' })).toBe(4);
    expect(registrationProgress({ state: 'identity_review', requestedName: 'Requested name' })).toBe(4);
    expect(registrationProgress({ state: 'ready' })).toBe(4);
  });
});
