import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import { useAccountRegistration } from './useAccountRegistration';

const mocks = vi.hoisted(() => ({
  pendingAccount: vi.fn(), resumeRegistration: vi.fn(), subscribeToRegistrationAuth: vi.fn(), registrationSignOut: vi.fn(),
}));
vi.mock('@/shared/services/accountRegistrationService', () => ({
  ...mocks, registrationRequest: vi.fn(), savePendingAccount: vi.fn(), signInForRegistration: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.pendingAccount.mockReturnValue({ userId: 'old', nonce: 'capability', email: 'old@example.com' });
  mocks.subscribeToRegistrationAuth.mockReturnValue(vi.fn());
});

describe('registration auth lifecycle', () => {
  it('clears an already rendered registration after signout', async () => {
    mocks.resumeRegistration.mockResolvedValue({ state: 'identity_review', email: 'old@example.com' });
    const { result } = renderHook(() => useAccountRegistration());
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.registration?.state).toBe('identity_review');
    const onSignOut = mocks.subscribeToRegistrationAuth.mock.calls[0]?.[0] as () => void;
    act(() => onSignOut());
    expect(result.current.registration).toBeNull();
    expect(result.current.error).toBe('');
  });
  it.each(['resolved', 'rejected'] as const)('ignores an old restoration request that %s after signout', async (outcome) => {
    let finish: (value: AccountRegistration) => void = () => {};
    let fail: (reason: Error) => void = () => {};
    const restoration = new Promise<AccountRegistration>((resolve, reject) => { finish = resolve; fail = reject; });
    mocks.resumeRegistration.mockReturnValue(restoration);
    const { result } = renderHook(() => useAccountRegistration());
    await waitFor(() => expect(mocks.resumeRegistration).toHaveBeenCalledOnce());
    const onSignOut = mocks.subscribeToRegistrationAuth.mock.calls[0]?.[0] as () => void;
    await act(async () => {
      onSignOut();
      if (outcome === 'resolved') finish({ state: 'ready', email: 'old@example.com' });
      else fail(new Error('Old account state unavailable'));
      await restoration.catch(() => null);
    });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.registration).toBeNull();
    expect(result.current.error).toBe('');
    expect(result.current.restoreFailed).toBe(false);
  });
  it('explicitly starting another signup clears the in-memory pending account', async () => {
    mocks.resumeRegistration.mockResolvedValue(null);
    mocks.registrationSignOut.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccountRegistration());
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.registration?.email).toBe('old@example.com');
    await act(async () => { await result.current.startNewRegistration(); });
    expect(mocks.registrationSignOut).toHaveBeenCalledOnce();
    expect(result.current.registration).toBeNull();
  });
});
