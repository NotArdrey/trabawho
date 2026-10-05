import { assertEquals, assertNotEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { encryptRegistrationPassword, decryptRegistrationPassword } from './registrationCredentials.ts';
import { manualDocument } from './manualRegistrationEvidence.ts';
import { AccountError } from './accountRegistration.ts';

Deno.test('draft credentials are randomized, authenticated, bound to the draft, and decrypt only with the original secret', async () => {
  const previous=Deno.env.get('DIDIT_SESSION_NONCE_SECRET');
  Deno.env.set('DIDIT_SESSION_NONCE_SECRET','isolated-test-secret');
  try {
    const id=crypto.randomUUID(),password='Private Password!';
    const encrypted=await encryptRegistrationPassword(id,password);
    assertNotEquals(encrypted,await encryptRegistrationPassword(id,password));
    assertEquals(atob(encrypted).includes(password),false);
    assertEquals(await decryptRegistrationPassword(id,encrypted),password);
    await assertRejects(()=>decryptRegistrationPassword(crypto.randomUUID(),encrypted));
    const tampered=Uint8Array.from(atob(encrypted),char=>char.charCodeAt(0));
    tampered[20]^=1;
    await assertRejects(()=>decryptRegistrationPassword(id,btoa(String.fromCharCode(...tampered))));
    Deno.env.set('DIDIT_SESSION_NONCE_SECRET','another-secret');
    await assertRejects(()=>decryptRegistrationPassword(id,encrypted));
    Deno.env.delete('DIDIT_SESSION_NONCE_SECRET');
    await assertRejects(()=>encryptRegistrationPassword(id,password));
  } finally {
    if(previous===undefined) Deno.env.delete('DIDIT_SESSION_NONCE_SECRET');
    else Deno.env.set('DIDIT_SESSION_NONCE_SECRET',previous);
  }
});
Deno.test('manual documents require consent and an unexpired date or explicit no expiration', () => {
  const valid={fullName:'Ana María Santos',documentType:'passport',documentNumber:'PASSPORT-123',acceptedIdentityTerms:true,expiry:'2099-01-01'};
  assertEquals(manualDocument(valid).expiry,'2099-01-01');
  assertEquals(manualDocument({...valid,noExpiration:true,expiry:'',backNotApplicable:true}).backNotApplicable,true);
  for(const patch of [{acceptedIdentityTerms:false},{fullName:'123'},{expiry:'2000-01-01'},{expiry:'2099-02-31'},{expiry:'',noExpiration:false}])
    assertThrows(()=>manualDocument({...valid,...patch}),AccountError);
});
