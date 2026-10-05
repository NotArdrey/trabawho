// Draft credentials are encrypted on the server and removed after account creation.
// The browser stores only the registration ID and its recovery capability.
async function key() {
  const secret = Deno.env.get('DIDIT_SESSION_NONCE_SECRET');
  if (!secret) throw new Error('Registration encryption is unavailable');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`registration:v3:${secret}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptRegistrationPassword(id: string, password: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    await key(), new TextEncoder().encode(password));
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
}
export async function decryptRegistrationPassword(id: string, ciphertext: string) {
  const bytes = Uint8Array.from(atob(ciphertext), char => char.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(id) },
    await key(), bytes.slice(12));
  return new TextDecoder().decode(plain);
}
