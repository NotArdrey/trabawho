export type PendingAccount = { userId: string; nonce: string; email: string; signupName?: string };
const pendingKey = 'trabawho.pendingAccount.v2';
const legacyKey = 'trabawho.identitySignup.v1';
let currentAccount: PendingAccount | null = null;

export function clearPendingAccount(): void {
  currentAccount = null;
  try { sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(legacyKey); }
  catch { /* Auth cleanup still succeeds when browser storage is unavailable. */ }
}

export function savePendingAccount(account: PendingAccount): void {
  // Registration belongs to this page only. Reloading or leaving starts over.
  clearPendingAccount();
  currentAccount = account;
}

export function pendingAccount(): PendingAccount | null {
  try { sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(legacyKey); }
  catch { /* Registration remains usable without browser storage. */ }
  return currentAccount;
}
