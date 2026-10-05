import { z } from 'zod';

export type PendingAccount = { userId: string; nonce: string; email: string; signupName?: string };
const pendingKey = 'trabawho.pendingAccount.v2';
const legacyKey = 'trabawho.identitySignup.v1';

export function clearPendingAccount(): void {
  try { sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(legacyKey); }
  catch { /* Auth cleanup still succeeds when browser storage is unavailable. */ }
}

export function savePendingAccount(account: PendingAccount): void {
  // Persist recovery information and the unverified name, never credentials.
  try { sessionStorage.setItem(pendingKey, JSON.stringify(account)); sessionStorage.removeItem(legacyKey); }
  catch { /* The current page keeps recovery in memory if storage is disabled. */ }
}

export function pendingAccount(): PendingAccount | null {
  try {
    sessionStorage.removeItem(legacyKey);
    const result = z.object({ userId: z.string(), nonce: z.string(), email: z.string(), signupName: z.string().optional() })
      .safeParse(JSON.parse(sessionStorage.getItem(pendingKey) || 'null'));
    return result.success ? result.data : null;
  } catch { return null; }
}
