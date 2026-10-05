import { describe, expect, it } from 'vitest';
import { registrationProgress } from './registrationProgress';

describe('registration progress', () => {
  it('shows account and identity without skipping verification', () => {
    expect(registrationProgress(null)).toBe(1);
    expect(registrationProgress({ state: 'identity_pending', signupName: '' })).toBe(2);
    expect(registrationProgress({ state: 'identity_pending', signupName: 'Maria Santos' })).toBe(2);
    expect(registrationProgress({ state: 'email_pending' })).toBe(2);
    expect(registrationProgress({ state: 'email_pending', signupName: 'Maria Santos' })).toBe(2);
    expect(registrationProgress({ state: 'identity_in_progress' })).toBe(2);
    expect(registrationProgress({ state: 'declined' })).toBe(2);
    expect(registrationProgress({ state: 'name_pending' })).toBe(2);
  });
  it('keeps all identity and extracted-name review in the final identity step', () => {
    expect(registrationProgress({ state: 'identity_review' })).toBe(2);
    expect(registrationProgress({ state: 'identity_review', requestedName: 'Requested name' })).toBe(2);
  });
});
