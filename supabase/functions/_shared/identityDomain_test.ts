import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildProfilePayload, extractIdentityDocument, normalizeStatus, resolveDiditDecisionStatus, validateSignupDetails } from "./identityDomain.ts";
import { canonicalDiditJson, signDiditBody, verifyDiditSignature } from "./diditSignature.ts";
import { identityReturnUrl } from "./identityRedirect.ts";

Deno.test("overall Didit decision controls all workflow checks", () => {
  for (const status of ["In Review", "Declined", "Kyc Expired", "Approved"]) {
    const result = resolveDiditDecisionStatus({ status, id_verifications: [{ status: "Approved" }], face_matches: [{ status: "Approved" }] });
    assertEquals(result, normalizeStatus(status));
  }
  assertEquals(resolveDiditDecisionStatus({ status: "Approved", id_verifications: [{ status: "Approved" }] }), "APPROVED");
  assertEquals(resolveDiditDecisionStatus({ status: "Resubmitted" }), "PENDING");
  assertEquals(resolveDiditDecisionStatus({ status: "Awaiting User" }), "PENDING");
  assertEquals(resolveDiditDecisionStatus({ status: "unexpected" }), "");
});
Deno.test("V3 document data takes precedence over form fallbacks", () => {
  const actual = extractIdentityDocument({ status: "Approved", id_verifications: [{ document_number: "LIVE-ID", issuing_state: "PHL", full_name: "Verified Person", document_type: "Identity Card", date_of_birth: "1990-01-01", expiration_date: "2030-10-02" }] }, { fullName: "User input", documentType: "Passport" });
  assertEquals(actual.fullName, "Verified Person"); assertEquals(actual.documentType, "identity_card");
  assertEquals(actual.documentNumber, "LIVE-ID"); assertEquals(actual.birthDate, "1990-01-01");
});
Deno.test("signup requires address, explicit consents, public role, and valid email", () => {
  const body = { province: "La Union", city: "Balaoan", barangay: "Almeida", address: "12 Main Street", email: "person@example.com", appRole: "client", acceptedIdentityTerms: true, acceptedRaTerms: true };
  assertEquals(validateSignupDetails(body).address, "12 Main Street");
  assertThrows(() => validateSignupDetails({ ...body, barangay: " " }));
  assertThrows(() => validateSignupDetails({ ...body, acceptedRaTerms: "true" }));
  assertThrows(() => validateSignupDetails({ ...body, appRole: "admin" }));
  assertThrows(() => validateSignupDetails({ ...body, email: "invalid" }));
  assertThrows(() => validateSignupDetails({ ...body, password: " Password123!" }));
});
Deno.test("identity approval never implies email confirmation or account restoration", () => {
  const input = { user: { id: "user-1" }, email: "person@example.com", fullName: "Person", appRole: "worker", identityRole: "musician", identityStatus: "APPROVED", location: { province: "A", city: "B", barangay: "C", address: "D" } };
  const pendingEmail = buildProfilePayload(input);
  assertEquals(pendingEmail.is_verified, false); assertEquals(pendingEmail.address, "D");
  assert(!("account_status" in pendingEmail));
  assertEquals(buildProfilePayload({ ...input, user: { id: "user-1", email_confirmed_at: "2026-10-02" } }).is_verified, true);
  assertEquals(buildProfilePayload({ ...input, identityStatus: "PENDING_REVIEW", user: { id: "user-1", email_confirmed_at: "2026-10-02" } }).is_verified, false);
});
Deno.test("Didit V2 canonical JSON handles Unicode and integer-like keys", () => {
  assertEquals(canonicalDiditJson({ "2": "two", "10": "ten", name: "José", nested: { z: 1.0, a: [true, null] } }), '{"10":"ten","2":"two","name":"José","nested":{"a":[true,null],"z":1}}');
});
Deno.test("signed webhook rejects tampering, stale body timestamps, and Simple signatures", async () => {
  const payload = { status: "Approved", timestamp: 1790942400, event_id: "event", decision: { full_name: "José" } };
  const now = payload.timestamp * 1000;
  const secret = "test-secret";
  const raw = JSON.stringify(payload, null, 2);
  const headers = new Headers({ "x-timestamp": String(payload.timestamp), "x-signature-v2": await signDiditBody(canonicalDiditJson(payload), secret) });
  assert(await verifyDiditSignature(raw, payload, headers, secret, now));
  assert(!await verifyDiditSignature(raw, { ...payload, status: "Declined" }, headers, secret, now));
  assert(!await verifyDiditSignature(raw, payload, headers, secret, now + 301000));
  const newHeaders = new Headers(headers); newHeaders.set("x-timestamp", String(payload.timestamp + 10));
  assert(!await verifyDiditSignature(raw, payload, newHeaders, secret, now));
  const legacy = new Headers({ "x-timestamp": String(payload.timestamp), "x-signature": await signDiditBody(raw, secret) });
  assert(await verifyDiditSignature(raw, payload, legacy, secret, now));
  const simple = new Headers({ "x-timestamp": String(payload.timestamp), "x-signature-simple": await signDiditBody(`${payload.timestamp}:session:Approved:status.updated`, secret) });
  assert(!await verifyDiditSignature(raw, payload, simple, secret, now));
});
Deno.test("return URL rejects external redirects and preserves the login fragment", () => {
  assertEquals(identityReturnUrl("https://app.example.com/?a=1#login", "https://app.example.com").hash, "#login");
  assertThrows(() => identityReturnUrl("https://evil.example.com/", "https://app.example.com"));
  assertThrows(() => identityReturnUrl("https://user:pass@app.example.com/", "https://app.example.com"));
});
