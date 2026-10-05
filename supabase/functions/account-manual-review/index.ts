import { registrationUser } from "../_shared/pendingRegistrationAccess.ts";
import { corsHeaders, jsonResponse, buildIdentityDocumentFingerprint, recordRegistrationAttempt } from "../_shared/identityRegistration.ts";
import { asRecord } from "../_shared/identityDomain.ts";
import { accountClient, AccountError, registrationState, text } from "../_shared/accountRegistration.ts";
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const client = accountClient(); const paths: string[] = [];
  try {
    const body = asRecord(await request.json());
    const user = await registrationUser(request, client, body);
    const fullName = text(body.fullName); const documentType = text(body.documentType); const documentNumber = text(body.documentNumber);
    if (fullName.length < 2 || fullName.length > 200 || !documentType || documentType.length > 100 || !documentNumber || body.acceptedIdentityTerms !== true)
      throw new AccountError("Provide the name, document type, number, evidence, and identity consent.");
    const expiry = text(body.expiry);
    if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || expiry < new Date().toISOString().slice(0,10))) throw new AccountError("Use a valid, unexpired document.");
    const state = await registrationState(client, user);
    if (!['identity_pending','declined','identity_in_progress'].includes(state.state)) throw new AccountError("This identity is already awaiting review or approved.", 409);
    await recordRegistrationAttempt(client, request, { action: "manual_identity_review", email: user.email, userId: user.id });
    const evidence: Record<string,string> = {};
    for (const slot of ['front','back','selfie']) {
      const image = asRecord(body[`${slot}Image`]); const mimeType = text(image.mimeType);
      if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) throw new AccountError("Choose JPEG, PNG, or WebP evidence.");
      const base64 = text(image.base64).split(',').pop() || '';
      if (!base64 || base64.length > Math.ceil(7*1024*1024*4/3)+4) throw new AccountError("Each image must be at most 7 MB.");
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      if (!bytes.length || bytes.length > 7*1024*1024) throw new AccountError("Each image must be at most 7 MB.");
      const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
      const path = `${user.id}/${crypto.randomUUID()}-${slot}.${extension}`;
      const uploaded = await client.storage.from('identity-manual').upload(path,bytes,{contentType:mimeType,upsert:false});
      if (uploaded.error) throw new AccountError("Identity evidence could not be uploaded. Retry.",503);
      paths.push(path); evidence[slot] = path;
    }
    const document = { fullName, documentType, expiry };
    const fingerprint: string | null = await buildIdentityDocumentFingerprint({}, { ...document, documentNumber });
    const saved = await client.rpc('submit_account_manual_review',{p_user_id:user.id,p_document:document,p_fingerprint:fingerprint,p_evidence:evidence});
    if (saved.error) throw new AccountError("The review could not be saved. Refresh your registration and retry.",409);
    paths.length = 0;
    return jsonResponse(await registrationState(client,user));
  } catch (cause) {
    if (paths.length) await client.storage.from('identity-manual').remove(paths);
    const error = cause instanceof AccountError ? cause : new AccountError("Manual review could not be submitted. Retry.",503);
    return jsonResponse({error:error.message},error.status);
  }
});
