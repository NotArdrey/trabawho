import { describe, expect, it } from 'vitest';
import { canResendRegistrationEmail, registrationEmailStatus } from './registrationEmailStatus';

describe('registration email recovery', () => {
  it('does not ask pending-review users to resend before approval', () => {
    const message = registrationEmailStatus({ identityStatus: 'PENDING_REVIEW', emailDelivery: { sent: false, skipped: true } }, 'APPROVED');
    expect(message).toContain('identity review is approved');
    expect(canResendRegistrationEmail('login', '', message)).toBe(false);
  });

  it('shows a resend path when an approved account did not get a confirmation request', () => {
    const message = registrationEmailStatus({ identityStatus: 'APPROVED', emailDelivery: { sent: false } }, 'APPROVED');
    expect(message).toContain('could not be requested');
    expect(canResendRegistrationEmail('login', '', message)).toBe(true);
  });

  it('preserves the confirmed-request message and supports retry after a sign-in error', () => {
    expect(registrationEmailStatus({ identityStatus: 'APPROVED', emailDelivery: { sent: true } }, 'APPROVED'))
      .toContain('Confirm your email');
    expect(canResendRegistrationEmail('login', 'Email not confirmed', '')).toBe(true);
    expect(canResendRegistrationEmail('register', 'Email not confirmed', '')).toBe(false);
  });
});
