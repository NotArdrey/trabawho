import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signOutUser } from './authSessionService';
import { pendingAccount, savePendingAccount } from './pendingAccountRecovery';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/integrations/supabase', () => ({ supabase: { auth: { signOut } } }));
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });

describe('logout registration cleanup', () => {
  it('clears pending and legacy signup after logout so another account starts fresh', async () => {
    savePendingAccount({ userId: 'old', nonce: 'capability', email: 'old@example.com' });
    sessionStorage.setItem('trabawho.identitySignup.v1', 'legacy');
    sessionStorage.setItem('unrelated-setting', 'keep');
    signOut.mockResolvedValue({ error: null });
    await signOutUser();
    expect(pendingAccount()).toBeNull();
    expect(sessionStorage.getItem('trabawho.identitySignup.v1')).toBeNull();
    expect(sessionStorage.getItem('unrelated-setting')).toBe('keep');
  });
  it('preserves recovery if logout fails, allowing the user to retry', async () => {
    savePendingAccount({ userId: 'old', nonce: 'capability', email: 'old@example.com' });
    signOut.mockResolvedValue({ error: new Error('Unable to sign out') });
    await expect(signOutUser()).rejects.toThrow('Unable to sign out');
    expect(pendingAccount()?.userId).toBe('old');
  });
  it('still completes logout when browser storage is unavailable', async () => {
    signOut.mockResolvedValue({ error: null });
    const storage = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    await expect(signOutUser()).resolves.toBeUndefined();
    storage.mockRestore();
  });
});
