import { encrypt, decrypt } from './token.crypto';

// Mocks: none — pure unit tests
const KEY = 'b'.repeat(64); // valid 32-byte key as hex
const WRONG_KEY = 'c'.repeat(64);

describe('token crypto', () => {
  describe('encrypt', () => {
    it('produces output different from the plaintext', () => {
      const ciphertext = encrypt('secret-token', KEY);
      expect(ciphertext).not.toBe('secret-token');
    });

    it('produces different ciphertext each call (random IV)', () => {
      const a = encrypt('secret-token', KEY);
      const b = encrypt('secret-token', KEY);
      expect(a).not.toBe(b);
    });

    it('throws when key is empty', () => {
      expect(() => encrypt('secret-token', '')).toThrow('TOKEN_ENCRYPTION_KEY');
    });

    it('throws when key is wrong length', () => {
      expect(() => encrypt('secret-token', 'abc')).toThrow(
        'TOKEN_ENCRYPTION_KEY',
      );
    });
  });

  describe('decrypt', () => {
    it('recovers the original plaintext', () => {
      const ciphertext = encrypt('secret-token', KEY);
      expect(decrypt(ciphertext, KEY)).toBe('secret-token');
    });

    it('throws when decrypting with the wrong key', () => {
      const ciphertext = encrypt('secret-token', KEY);
      expect(() => decrypt(ciphertext, WRONG_KEY)).toThrow();
    });

    it('throws when ciphertext is tampered', () => {
      const ciphertext = encrypt('secret-token', KEY);
      const tampered = ciphertext.slice(0, -4) + 'xxxx';
      expect(() => decrypt(tampered, KEY)).toThrow();
    });
  });
});
