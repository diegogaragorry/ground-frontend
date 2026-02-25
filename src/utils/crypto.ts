/**
 * E2EE: key derivation (password + salt) and AES-GCM encrypt/decrypt.
 * Salt and keys are base64 (raw bytes).
 */

const PBKDF2_ITERATIONS = 120_000;
const AES_KEY_LEN = 256;
const IV_LEN = 12;
const TAG_LEN = 16;

function base64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * Derive a 32-byte encryption key from password and salt (base64).
 * Used at login to get K for encrypt/decrypt and recovery package.
 */
export async function deriveEncryptionKey(password: string, saltBase64: string): Promise<string> {
  const salt = base64ToBuf(saltBase64);
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: AES_KEY_LEN },
    true,
    ["encrypt", "decrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", aesKey);
  return bufToBase64(raw);
}

/**
 * Encrypt plaintext (string) with key K (base64). Returns base64(IV || ciphertext || tag).
 */
export async function encryptWithKey(plaintext: string, keyBase64: string): Promise<string> {
  const keyBuf = base64ToBuf(keyBase64);
  if (keyBuf.length !== 32) throw new Error("Key must be 32 bytes");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, tagLength: TAG_LEN * 8 },
    cryptoKey,
    encoded
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv as Uint8Array, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return bufToBase64(combined);
}

/**
 * Decrypt ciphertext (base64 of IV||ciphertext||tag) with key K (base64). Returns plaintext string.
 */
export async function decryptWithKey(ciphertextBase64: string, keyBase64: string): Promise<string> {
  const keyBuf = base64ToBuf(keyBase64);
  if (keyBuf.length !== 32) throw new Error("Key must be 32 bytes");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const combined = base64ToBuf(ciphertextBase64);
  if (combined.length < IV_LEN + TAG_LEN + 1) throw new Error("Invalid ciphertext");
  const iv = combined.subarray(0, IV_LEN);
  const cipher = combined.subarray(IV_LEN);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, tagLength: TAG_LEN * 8 },
    cryptoKey,
    cipher as BufferSource
  );
  return new TextDecoder().decode(plain);
}

/**
 * Generate a random encryption salt (16 bytes, base64).
 * Sent once at registration; used later for E2EE key derivation.
 */
export function generateEncryptionSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufToBase64(bytes);
}

/**
 * Generate a 32-byte recovery key (base64). Used when user has no password-derived key yet (e.g. recovery flow returns it).
 */
export function generateRecoveryKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufToBase64(bytes);
}
