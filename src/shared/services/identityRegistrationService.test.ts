import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDiditIdentitySession, finishDiditIdentitySignup, loadIdentitySignupState, startDiditIdentitySession, submitManualIdentityReview } from './identityRegistrationService';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { functions: { invoke } } }));
vi.mock('./registrationLogger', () => ({ logRegistrationDebug: vi.fn(), getRegistrationFormLogSnapshot: vi.fn(), sanitizeRegistrationLogValue: vi.fn() }));
const location = { province: 'La Union', city: 'Balaoan', barangay: 'Almeida', address: '12 Main Street' };
const input = { email: 'Person@example.com', password: 'Password123!', accountRole: 'client', documentTypeKey: 'id_card', acceptedIdentityTerms: true, acceptedRaTerms: true, ...location };

beforeEach(() => { invoke.mockReset(); window.sessionStorage.clear(); });

describe('identity signup location transport', () => {
  it('accepts nullable Didit status metadata returned by the backend', async () => {
    invoke.mockResolvedValue({ data: { success: true, sessionId: 'session-1', status: 'PENDING_REVIEW', businessStatus: 'PENDING_REVIEW', diditResolvedStatus: null, rawDiditStatus: null, verification_data: { status: 'PENDING_REVIEW' } }, error: null });
    await expect(fetchDiditIdentitySession('session-1')).resolves.toMatchObject({ status: 'PENDING_REVIEW' });
  });
  it('accepts a session response without an optional workflow ID', async () => {
    invoke.mockResolvedValue({ data: { success: true, sessionId: 'session-1', verificationUrl: 'https://verification.didit.me/demo', workflowId: null }, error: null });
    await expect(startDiditIdentitySession(input)).resolves.toMatchObject({ workflowId: null });
  });
  it('keeps location through session storage and Didit completion', async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, sessionId: 'session-1', sessionNonce: 'nonce-1', verificationUrl: 'https://verification.didit.me/demo' }, error: null });
    await startDiditIdentitySession(input);
    const restored = loadIdentitySignupState();
    expect(restored).toMatchObject({ ...location, acceptedIdentityTerms: true, acceptedRaTerms: true });
    invoke.mockResolvedValueOnce({ data: { success: true, status: 'APPROVED' }, error: null });
    await fetchDiditIdentitySession('session-1');
    expect(invoke.mock.lastCall?.[1]).toMatchObject({ body: { session_nonce: 'nonce-1' } });
    invoke.mockResolvedValueOnce({ data: { success: true, identityStatus: 'APPROVED' }, error: null });
    if (!restored) throw new Error('Expected a restored session');
    await finishDiditIdentitySignup(restored, 'APPROVED');
    expect(invoke.mock.lastCall?.[0]).toBe('create-unverified-user');
    const request: unknown = invoke.mock.lastCall?.[1];
    expect(request).toMatchObject({ body: { ...location, sessionNonce: 'nonce-1', acceptedIdentityTerms: true, acceptedRaTerms: true } });
    expect(loadIdentitySignupState()).toBeNull();
  });
  it('includes the complete location in manual review requests', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    await submitManualIdentityReview({ ...input, documentTypeKey: 'umid', manualFullName: 'Juan Dela Cruz' });
    expect(invoke.mock.lastCall?.[0]).toBe('manual-identity-review');
    const request: unknown = invoke.mock.lastCall?.[1];
    expect(request).toMatchObject({ body: { ...location, acceptedIdentityTerms: true, acceptedRaTerms: true } });
  });
  it('ignores malformed saved sessions and rejects malformed service responses', async () => {
    window.sessionStorage.setItem('trabawho.identitySignup.v1', '{"diditSessionId":12}');
    expect(loadIdentitySignupState()).toBeNull();
    invoke.mockResolvedValue({ data: { sessionId: 12 }, error: null });
    await expect(startDiditIdentitySession(input)).rejects.toThrow('unexpected response');
  });
});
