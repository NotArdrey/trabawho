import { describe, expect, it } from 'vitest';
import { isAccountBlockedForLogin } from '@/shared/services/authService';

const blockReason = isAccountBlockedForLogin as unknown as (profile: Record<string, unknown>) => string;
const profile = { accountStatus: 'active', identityRequired: true, identityVerificationStatus: 'APPROVED', isVerified: true };

describe('identity registration access gates', () => {
  it('keeps manual and Didit reviews blocked even when an admin restores account access', () => {
    expect(blockReason({ ...profile, identityVerificationStatus: 'PENDING_REVIEW' })).toContain('identity review is still pending');
  });
  it('requires approval and email confirmation before allowing access', () => {
    expect(blockReason({ ...profile, identityVerificationStatus: 'PENDING' })).toContain('Identity verification is still required');
    expect(blockReason({ ...profile, isVerified: false })).toContain('confirm your email');
    expect(blockReason(profile)).toBe('');
  });
  it('blocks declined and expired identities', () => {
    expect(blockReason({ ...profile, identityVerificationStatus: 'DECLINED' })).toContain('verification was not completed');
    expect(blockReason({ ...profile, idDocumentExpiry: '2000-01-01' })).toContain('document has expired');
  });
  it('preserves admin account restrictions after identity approval', () => {
    expect(blockReason({ ...profile, accountStatus: 'disabled' })).toContain('disabled by an administrator');
    expect(blockReason({ ...profile, accountStatus: 'suspended', suspendedUntil: '2099-01-01T00:00:00Z' })).toContain('suspended until');
  });
});
