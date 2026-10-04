import { describe, expect, it } from 'vitest';
import { registrationProgress } from './registrationProgress';

describe('registration progress', () => {
  it('shows the account, email, identity, and name stages without skipping verification', () => {
    expect(registrationProgress(null)).toBe(1);
    expect(registrationProgress({ state: 'email_pending' })).toBe(2);
    expect(registrationProgress({ state: 'identity_in_progress' })).toBe(3);
    expect(registrationProgress({ state: 'declined' })).toBe(3);
    expect(registrationProgress({ state: 'name_pending' })).toBe(4);
  });
  it('distinguishes identity evidence review from a disputed extracted name', () => {
    expect(registrationProgress({ state: 'identity_review' })).toBe(3);
    expect(registrationProgress({ state: 'identity_review', requestedName: 'Requested name' })).toBe(4);
  });
});
