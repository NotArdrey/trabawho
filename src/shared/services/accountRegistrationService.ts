import { z } from 'zod';
import { supabase } from '@/integrations/supabase';

const stateSchema = z.object({
  state: z.enum(['legacy', 'email_pending', 'identity_pending', 'identity_in_progress', 'name_pending', 'identity_review', 'declined', 'ready']),
  email: z.string().optional(), legalName: z.string().nullable().optional(), documentType: z.string().nullable().optional(),
  requestedName: z.string().nullable().optional(), nameIssue: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(), sessionUrl: z.string().url().nullable().optional(),
  providerStatus: z.string().optional(), providerSetupComplete: z.boolean().optional(),
  pendingAccount: z.object({ userId: z.string(), nonce: z.string() }).optional(),
  emailDelivery: z.object({ sent: z.boolean() }).optional(),
  signupRole: z.enum(['client', 'worker']).optional(),
});
export type AccountRegistration = z.infer<typeof stateSchema>;
export type SignupRole = NonNullable<AccountRegistration['signupRole']>;
export type PendingAccount = { userId: string; nonce: string; email: string };
const pendingKey = 'trabawho.pendingAccount.v2';

export async function accountRequest(name: string, body: Record<string, unknown>): Promise<unknown> {
  const result = await supabase.functions.invoke<unknown>(name, { body });
  if (result.error) {
    const error: unknown = result.error;
    if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      const payload: unknown = await error.context.clone().json().catch(() => null);
      const parsed = z.object({ error: z.string() }).safeParse(payload);
      if (parsed.success) throw new Error(parsed.data.error);
    }
    throw new Error('The service could not be reached. Check your connection and retry.');
  }
  const rejected = z.object({ error: z.string() }).safeParse(result.data);
  if (rejected.success) throw new Error(rejected.data.error);
  return result.data;
}
export async function registrationRequest(name: string, body: Record<string, unknown>) {
  return stateSchema.parse(await accountRequest(name, { ...body, redirectTo: `${window.location.origin}/register` }));
}
export function savePendingAccount(account: PendingAccount) {
  // Only an expiring recovery capability and email are persisted. Never credentials.
  try { sessionStorage.setItem(pendingKey, JSON.stringify(account)); sessionStorage.removeItem('trabawho.identitySignup.v1'); } catch { /* The current page keeps recovery in memory if storage is disabled. */ }
}
export function pendingAccount(): PendingAccount | null {
  try {
    sessionStorage.removeItem('trabawho.identitySignup.v1');
    const result = z.object({ userId: z.string(), nonce: z.string(), email: z.string() }).safeParse(JSON.parse(sessionStorage.getItem(pendingKey) || 'null'));
    return result.success ? result.data : null;
  } catch { return null; }
}
export async function resumeRegistration() {
  const session = await supabase.auth.getSession();
  if (session.error) throw new Error('Your session could not be restored. Sign in again.');
  if (!session.data.session) return null;
  return registrationRequest('account-registration', { action: 'state' });
}
export async function signInForRegistration(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error(result.error.message);
  return registrationRequest('account-registration', { action: 'state' });
}
export async function resendFromSignIn(email: string) {
  const result = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/register` } });
  if (result.error) throw new Error(result.error.message);
}
export async function routePendingRegistration(pathname: string): Promise<boolean> {
  if (pathname === '/register') return true;
  const state = await resumeRegistration();
  if (state && !['legacy', 'ready'].includes(state.state)) {
    window.location.replace('/register'); return true;
  }
  return false;
}
export async function registrationSignOut() {
  sessionStorage.removeItem(pendingKey);
  const result = await supabase.auth.signOut();
  if (result.error) throw new Error('Sign out could not be completed. Retry.');
}
export async function encodeIdentityImage(file: File | null) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 7 * 1024 * 1024 || file.size === 0)
    throw new Error('Choose JPEG, PNG, or WebP evidence up to 7 MB for each image.');
  return new Promise<{ base64: string; mimeType: string; fileName: string }>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve({ base64: reader.result, mimeType: file.type, fileName: file.name }) : reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
}
