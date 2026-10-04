import { corsHeaders, createSessionNonce, hashSessionNonce, verifySessionNonce, recordRegistrationAttempt,
  sendEmailConfirmation, jsonResponse, RegistrationRateLimitError } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { identityReturnUrl } from "../_shared/identityRedirect.ts";
import { accountClient, AccountError, accountUser, registrationRow, registrationState, signupRole, text } from "../_shared/accountRegistration.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const body = asRecord(await request.json());
    const client = accountClient();
    const returnUrl = identityReturnUrl(body.redirectTo, Deno.env.get("TRABAWHO_APP_URL") || "", Deno.env.get("IDENTITY_ALLOWED_ORIGINS") || "");
    returnUrl.pathname = "/register"; returnUrl.hash = ""; returnUrl.search = "";
    if (body.action === "create") {
      const role = signupRole(body.signupRole);
      const email = text(body.email).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128 || password !== password.trim() || body.acceptedTerms !== true)
        throw new AccountError("Enter a valid email, a password of at least 8 characters, and accept the Terms and Conditions.");
      await recordRegistrationAttempt(client, request, { action: "base_account", email });
      const created = await client.auth.admin.createUser({ email, password, email_confirm: false,
        user_metadata: { registration_version: 2, role, is_worker: role === 'worker', is_client: role === 'client' },
        app_metadata: { identity_required: true, verification_status: "UNVERIFIED", signup_role: role } });
      if (created.error || !created.data.user) throw new AccountError("This account could not be created. If the email is already registered, sign in or resend confirmation.");
      const user = created.data.user; const nonce = createSessionNonce();
      const initialized = await client.rpc("initialize_account_registration", { p_user_id: user.id, p_nonce_hash: await hashSessionNonce(user.id, nonce) });
      if (initialized.error) {
        await client.auth.admin.deleteUser(user.id);
        throw new AccountError("Account setup could not be saved. Retry.", 503);
      }
      const delivery = await sendEmailConfirmation(email, returnUrl.toString());
      await client.from("account_registrations").update({ email_sent_at: new Date().toISOString() }).eq("user_id", user.id);
      return jsonResponse({ state: "email_pending", email, signupRole: role, pendingAccount: { userId: user.id, nonce }, emailDelivery: delivery });
    }
    if (["resend", "change_email"].includes(text(body.action))) {
      const userId = text(body.userId);
      const row = await registrationRow(client, userId);
      if (!row || !(await verifySessionNonce(userId, body.nonce, row.pending_nonce_hash)))
        throw new AccountError("Your pending registration could not be validated. Sign in or request another confirmation link.", 403);
      if (new Date(text(row.pending_expires_at)).getTime() < Date.now())
        throw new AccountError("This pending registration expired. Use Sign in to resume or resend confirmation from there.", 410);
      const result = await client.auth.admin.getUserById(userId); const user = result.data.user;
      if (result.error || !user || user.email_confirmed_at) throw new AccountError("This email is already confirmed. Sign in to continue.", 409);
      await recordRegistrationAttempt(client, request, { action: "registration_email", email: user.email, userId });
      if (new Date(text(row.email_sent_at)).getTime() > Date.now() - 60000) throw new AccountError("Wait one minute before requesting another confirmation email.", 429);
      let email = user.email || "";
      if (body.action === "change_email") {
        email = text(body.email).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountError("Enter a valid email address.");
      }
      const claimed = await client.rpc('claim_pending_account_email', { p_user_id: userId,
        p_expected_hash: row.pending_nonce_hash, p_new_email: body.action === 'change_email' ? email : null });
      if (claimed.error) {
        if (claimed.error.code === '22023') throw new AccountError('Wait one minute before another confirmation request.', 429);
        if (claimed.error.code === '23505') throw new AccountError('This email already has an account. Sign in or choose another address.', 409);
        if (claimed.error.code === '42501') throw new AccountError('This pending registration expired or its email was confirmed. Sign in to resume.', 409);
        throw new AccountError('The email request could not be saved. Retry.', 503);
      }
      email = text(claimed.data);
      return jsonResponse({ state: "email_pending", email, emailDelivery: await sendEmailConfirmation(email, returnUrl.toString()) });
    }
    const user = await accountUser(request, client);
    return jsonResponse(await registrationState(client, user));
  } catch (cause) {
    const error = cause instanceof AccountError ? cause : cause instanceof RegistrationRateLimitError
      ? new AccountError("Too many attempts. Please wait before retrying.", 429) : new AccountError("Registration could not be completed. Retry.", 503);
    return jsonResponse({ error: error.message }, error.status);
  }
});
