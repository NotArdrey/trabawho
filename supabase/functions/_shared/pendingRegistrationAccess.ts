import { accountClient, accountUser, AccountError, registrationRow, requireActiveAccount, text } from "./accountRegistration.ts";
import { verifySessionNonce } from "./identityRegistration.ts";

// A recovery capability grants registration access only. It never grants marketplace access.
export async function registrationUser(request: Request, client: ReturnType<typeof accountClient>, body: Record<string, unknown>) {
  if (!body.userId && !body.nonce) return accountUser(request, client);
  const userId = text(body.userId);
  const row = await registrationRow(client, userId);
  if (!row || !await verifySessionNonce(userId, body.nonce, row.pending_nonce_hash))
    throw new AccountError("Your pending registration could not be validated. Sign in to resume.", 403);
  const expires = Date.parse(text(row.pending_expires_at));
  if (!Number.isFinite(expires) || expires < Date.now())
    throw new AccountError("This pending registration expired. Contact support to resume.", 410);
  await requireActiveAccount(client, userId);
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data.user) throw new AccountError("Your registration could not be loaded. Retry.", 503);
  return data.user;
}

export async function completedRegistrationSession(client: ReturnType<typeof accountClient>, email: string) {
  const link = await client.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data.properties?.hashed_token)
    throw new AccountError("Your account is ready. Sign in to continue.", 503);
  // Use a separate client: verifyOtp must not change the service client's authorization.
  const auth = accountClient();
  const result = await auth.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
  if (result.error || !result.data.session) throw new AccountError("Your account is ready. Sign in to continue.", 503);
  return { access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token };
}
