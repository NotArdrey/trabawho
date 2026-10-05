import { createLegacyRegistration } from '../_shared/legacyAccountCreation.ts';
import { createRegistrationDraft, ownedDraft, finalizeRegistrationDraft } from '../_shared/registrationDrafts.ts';
import { registrationUser, completedRegistrationSession } from "../_shared/pendingRegistrationAccess.ts";
import { corsHeaders, verifySessionNonce, recordRegistrationAttempt,
  sendEmailConfirmation, jsonResponse, RegistrationRateLimitError } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { identityReturnUrl } from "../_shared/identityRedirect.ts";
import { accountClient, AccountError, accountUser, registrationRow, registrationState, text } from "../_shared/accountRegistration.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const body = asRecord(await request.json());
    const client = accountClient();
    const returnUrl = identityReturnUrl(body.redirectTo, Deno.env.get("TRABAWHO_APP_URL") || "", Deno.env.get("IDENTITY_ALLOWED_ORIGINS") || "");
    returnUrl.pathname = "/register"; returnUrl.hash = ""; returnUrl.search = "";
    if (body.action === 'resend_from_sign_in') {
      const email = text(body.email).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountError('Enter a valid email address.');
      await recordRegistrationAttempt(client,request,{action:'registration_email',email});
      const profile = await client.from('profiles').select('user_id,identity_required,verification_status,id_document_expiry,account_status').eq('email',email).maybeSingle();
      if (profile.error) throw new AccountError('Email recovery is unavailable. Retry shortly.',503);
      const value = asRecord(profile.data);
      const approved = value.account_status==='active' && (value.identity_required!==true ||
        (value.verification_status==='APPROVED' && (!value.id_document_expiry || text(value.id_document_expiry)>=new Date().toISOString().slice(0,10))));
      if (approved) await sendEmailConfirmation(email,returnUrl.toString());
      // Keep the same response for nonexistent, restricted, and pending accounts.
      return jsonResponse({requested:true});
    }
    if (body.action === "create") return jsonResponse(body.registrationVersion===3
      ? await createRegistrationDraft(request,client,body) : await createLegacyRegistration(request,client,body));
    const draft = await ownedDraft(client,body);
    if (draft && !draft.finalized_at) {
      if (body.action === 'discard') {
        const result = await client.rpc('discard_registration_draft', { p_id: String(draft.id) });
        if (result.error) throw new AccountError('Registration could not be reset. Retry.',503);
        return jsonResponse(result.data ? { state: 'identity_pending' } : await finalizeRegistrationDraft(client,String(draft.id)));
      }
      if (body.action !== 'state') throw new AccountError('Complete identity verification before requesting confirmation.',409);
      return jsonResponse(await finalizeRegistrationDraft(client,String(draft.id)));
    }
    if (body.action === "state" && body.userId) {
      const user = await registrationUser(request, client, body);
      const state = await registrationState(client, user);
      return jsonResponse({ ...state, ...(state.state === "ready" && user.email
        ? { session: await completedRegistrationSession(client, user.email) } : {}) });
    }
    if (body.action === "save_name") {
      const user = await registrationUser(request, client, body);
      const state = await registrationState(client, user);
      if (state.state !== "identity_pending") throw new AccountError("Your identity verification has started. Use name review to request a correction.", 409);
      const name = text(body.signupName);
      if (name.length < 2 || name.length > 200 || !/\p{L}/u.test(name) || /[\p{Cc}\p{Cf}]/u.test(name))
        throw new AccountError("Enter your complete name using 2 to 200 characters.");
      await recordRegistrationAttempt(client, request, { action: "create_unverified_user", email: user.email, userId: user.id, metadata: { operation: "save_signup_name" } });
      const saved = await client.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, signup_name: name } });
      if (saved.error) throw new AccountError("Your name could not be saved. Retry.", 503);
      return jsonResponse({ ...state, signupName: name });
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
    return jsonResponse({ ...await registrationState(client, user), signupName: text(user.user_metadata.signup_name) || undefined });
  } catch (cause) {
    const error = cause instanceof AccountError ? cause : cause instanceof RegistrationRateLimitError
      ? new AccountError("Too many attempts. Please wait before retrying.", 429) : new AccountError("Registration could not be completed. Retry.", 503);
    return jsonResponse({ error: error.message }, error.status);
  }
});
