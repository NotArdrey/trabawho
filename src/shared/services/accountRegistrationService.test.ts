import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingAccount, registrationRequest, savePendingAccount, resumeRegistration } from './accountRegistrationService';
const { invoke, getSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn() }));
vi.mock('@/integrations/supabase', () => ({ supabase: { functions: { invoke }, auth: { getSession } } }));
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });
describe('account registration transport and recovery', () => {
  it('removes legacy credentials and persists only an expiring account recovery capability', () => {
    sessionStorage.setItem('trabawho.identitySignup.v1', JSON.stringify({ password: 'secret-old' }));
    savePendingAccount({ userId: 'account', nonce: 'recovery', email: 'person@example.com' });
    expect(sessionStorage.getItem('trabawho.identitySignup.v1')).toBeNull();
    expect(pendingAccount()).toEqual({ userId: 'account', nonce: 'recovery', email: 'person@example.com' });
    expect(JSON.stringify(sessionStorage)).not.toContain('password');
  });
  it('ignores malformed pending recovery data', () => {
    sessionStorage.setItem('trabawho.pendingAccount.v2', '{"userId":2}');
    expect(pendingAccount()).toBeNull();
  });
  it('uses the account-linked state and confirmation return route', async () => {
    invoke.mockResolvedValue({ data: { state: 'name_pending', legalName: 'Maria Isabel de la Cruz', documentType: 'passport' }, error: null });
    getSession.mockResolvedValue({ data: { session: { user: { id: 'account' } } }, error: null });
    await expect(resumeRegistration()).resolves.toMatchObject({ state: 'name_pending', legalName: 'Maria Isabel de la Cruz' });
    expect(invoke).toHaveBeenCalledWith('account-registration', { body: { action: 'state', redirectTo: `${window.location.origin}/register` } });
  });
  it('surfaces corrective Edge errors and rejects malformed gate states', async () => {
    invoke.mockResolvedValueOnce({ error: { context: new Response(JSON.stringify({ error: 'Confirm your email before identity verification.' }), { status: 403 }) } });
    await expect(registrationRequest('account-didit-session', {})).rejects.toThrow('Confirm your email');
    invoke.mockResolvedValueOnce({ data: { state: 'approved-by-browser' }, error: null });
    await expect(registrationRequest('account-registration', {})).rejects.toThrow();
  });
  it('restores the server-owned signup preference and rejects unsupported roles', async () => {
    invoke.mockResolvedValueOnce({ data: { state: 'ready', signupRole: 'worker' }, error: null });
    await expect(registrationRequest('account-registration', { action: 'state' })).resolves.toMatchObject({ signupRole: 'worker' });
    invoke.mockResolvedValueOnce({ data: { state: 'ready', signupRole: 'admin' }, error: null });
    await expect(registrationRequest('account-registration', { action: 'state' })).rejects.toThrow();
  });
});
