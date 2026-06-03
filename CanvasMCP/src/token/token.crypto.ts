import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { InvalidEncryptionKeyError } from '../common/errors';

// AES-256-GCM: symmetric encryption with built-in authentication.
// GCM produces an authentication tag that detects any tampering with the stored ciphertext.
const ALGORITHM = 'aes-256-gcm';

// GCM requires a 12-byte IV (Initialization Vector).
// 12 bytes is the recommended size for GCM — using a different size would require extra computation.
const IV_BYTES = 12;

// AES-256 requires a 32-byte key. We store it as a 64-character hex string (2 hex chars per byte).
const KEY_HEX_LENGTH = 64; // 32 bytes as hex

// parseKey validates and converts the hex key string into a raw Buffer for the crypto API.
// Throws InvalidEncryptionKeyError immediately if the key is missing or the wrong length —
// we fail loudly at startup rather than silently encrypting with a wrong key.
function parseKey(keyHex: string): Buffer {
  if (!keyHex || keyHex.length !== KEY_HEX_LENGTH) {
    throw new InvalidEncryptionKeyError(keyHex?.length ?? 0);
  }
  return Buffer.from(keyHex, 'hex');
}

// encrypt turns a plaintext string (e.g. a Canvas access token) into an encrypted string.
// A fresh random IV is generated on every call so that two encryptions of the same token
// produce completely different output — an attacker cannot spot patterns in the stored data.
// Output format: "ivHex:authTagHex:ciphertextHex" — all three parts are needed to decrypt.
export function encrypt(plaintext: string, keyHex: string): string {
  const key = parseKey(keyHex);

  // randomBytes(12) generates a cryptographically secure random IV for this encryption
  const iv = randomBytes(IV_BYTES);

  // createCipheriv sets up AES-256-GCM with our key and IV
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // cipher.update() encrypts the plaintext; cipher.final() flushes any remaining bytes
  // Buffer.concat joins them into a single encrypted buffer
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // getAuthTag() returns the GCM authentication tag generated during encryption.
  // This tag will be verified during decryption — if the ciphertext was tampered with,
  // the tag check fails and decryption throws an error.
  const authTag = cipher.getAuthTag();

  // Join all three pieces as hex strings separated by colons.
  // All three are required to decrypt: IV (to start the stream), authTag (to verify integrity),
  // encrypted (the actual ciphertext).
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// decrypt reverses encrypt() and returns the original plaintext.
// It also verifies the authentication tag — if the stored ciphertext was altered in any way,
// Node's crypto module throws before returning any data.
export function decrypt(ciphertext: string, keyHex: string): string {
  const key = parseKey(keyHex);

  // Split the stored string back into its three parts
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');

  // createDecipheriv sets up AES-256-GCM decryption with the same key and the stored IV
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));

  // Provide the authentication tag — GCM verifies it before releasing the plaintext
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  // Decrypt the ciphertext and return it as a UTF-8 string
  return decipher.update(dataHex, 'hex', 'utf8') + decipher.final('utf8');
}
