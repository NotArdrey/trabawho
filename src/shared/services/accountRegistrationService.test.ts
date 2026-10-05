import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingAccount, registrationRequest, savePendingAccount, resumeRegistration, signInForRegistration, subscribeToRegistrationAuth } from './accountRegistrationService';
const { invoke, getSession, signInWithPassword, onAuthStateChange, setSession } = vi.hoisted(() => ({ invoke: vi.fn(), getSession: vi.fn(), signInWithPassword: vi.fn(), onAuthStateChange: vi.fn(), setSession: vi.fn() }));
vi.mock('@/integrations/supabase', () => ({ supabase: { functions: { invoke }, auth: { getSession, signInWithPassword, onAuthStateChange, setSession } } }));
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });
describe('account registration transport and recovery', () => {
  it('retains pending recovery on refresh while signed out', async () => {
    savePendingAccount({ userId: 'pending', nonce: 'recovery', email: 'pending@example.com' });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    invoke.mockResolvedValue({ data: { state: 'identity_pending', signupName: 'Applicant Name' }, error: null });
    await expect(resumeRegistration()).resolves.toMatchObject({ state: 'identity_pending' });
    expect(pendingAccount()?.email).toBe('pending@example.com');
    expect(invoke).toHaveBeenCalledWith('account-registration', { body: { action: 'state', userId: 'pending', nonce: 'recovery', email: 'pending@example.com', redirectTo: `${window.location.origin}/register` } });
    expect(setSession).not.toHaveBeenCalled();
  });
  it('installs the completed account session and clears recovery after final identity approval', async () => {
    savePendingAccount({ userId: 'pending', nonce: 'recovery', email: 'pending@example.com' });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const session = { access_token: 'completed-access', refresh_token: 'completed-refresh' };
    invoke.mockResolvedValue({ data: { state: 'ready', session }, error: null });
    setSession.mockResolvedValue({ error: null });
    await expect(resumeRegistration()).resolves.toMatchObject({ state: 'ready' });
    expect(setSession).toHaveBeenCalledWith(session);
    expect(pendingAccount()).toBeNull();
  });
  it('retains recovery when installing the completed session fails', async () => {
    savePendingAccount({ userId: 'pending', nonce: 'recovery', email: 'pending@example.com' });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    invoke.mockResolvedValue({ data: { state: 'ready', session: { access_token: 'access', refresh_token: 'refresh' } }, error: null });
    setSession.mockResolvedValue({ error: new Error('Private Auth diagnostic') });
    await expect(resumeRegistration()).rejects.toThrow('Your account is ready. Sign in to continue.');
    expect(pendingAccount()?.userId).toBe('pending');
  });
  it('discards old pending recovery after a successful login, including a failed registration state read', async () => {
    savePendingAccount({ userId: 'old', nonce: 'recovery', email: 'old@example.com' });
    signInWithPassword.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ error: new Error('Unavailable') });
    await expect(signInForRegistration('new@example.com', 'secret')).rejects.toThrow();
    expect(pendingAccount()).toBeNull();
  });
  it('retains pending recovery after a failed login', async () => {
    savePendingAccount({ userId: 'old', nonce: 'recovery', email: 'old@example.com' });
    signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });
    await expect(signInForRegistration('new@example.com', 'wrong')).rejects.toThrow();
    expect(pendingAccount()?.userId).toBe('old');
  });
  it('clears old recovery when restoring an authenticated session', async () => {
    savePendingAccount({ userId: 'old', nonce: 'recovery', email: 'old@example.com' });
    getSession.mockResolvedValue({ data: { session: { user: { id: 'new' } } }, error: null });
    invoke.mockResolvedValue({ data: { state: 'ready' }, error: null });
    await resumeRegistration();
    expect(pendingAccount()).toBeNull();
  });
  it('clears recovery on auth changes and unsubscribes, while preserving unsigned initial sessions', () => {
    const unsubscribe = vi.fn();
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
    const onSignOut = vi.fn(); const onSignIn = vi.fn();
    const stop = subscribeToRegistrationAuth(onSignOut, onSignIn);
    const callback = onAuthStateChange.mock.calls[0]?.[0] as (event: string, session: unknown) => void;
    savePendingAccount({ userId: 'old', nonce: 'recovery', email: 'old@example.com' });
    callback('INITIAL_SESSION', null);
    expect(pendingAccount()).not.toBeNull();
    callback('SIGNED_IN', { user: { id: 'new' } });
    expect(pendingAccount()).toBeNull(); expect(onSignIn).toHaveBeenCalledOnce();
    savePendingAccount({ userId: 'old', nonce: 'recovery', email: 'old@example.com' });
    callback('SIGNED_OUT', null);
    expect(pendingAccount()).toBeNull(); expect(onSignOut).toHaveBeenCalledOnce();
    stop(); expect(unsubscribe).toHaveBeenCalledOnce();
  });
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
  it('restores the server-owned account type and rejects unsupported roles', async () => {
    invoke.mockResolvedValueOnce({ data: { state: 'ready', signupRole: 'worker' }, error: null });
    await expect(registrationRequest('account-registration', { action: 'state' })).resolves.toMatchObject({ signupRole: 'worker' });
    invoke.mockResolvedValueOnce({ data: { state: 'ready', signupRole: 'admin' }, error: null });
    await expect(registrationRequest('account-registration', { action: 'state' })).rejects.toThrow();
  });
});
