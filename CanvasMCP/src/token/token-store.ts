// EncryptedTokenRecord is the shape of a token record as it is stored.
// Both accessToken and refreshToken are stored already-encrypted — never as plaintext.
// Even if someone reads the in-memory store or database directly, they only see ciphertext.
export interface EncryptedTokenRecord {
  // Microsoft Teams user ID — used as the lookup key
  teamsUserId: string;
  // Canvas numeric user ID — needed to correlate the student's Canvas identity
  canvasUserId: number;
  // Access token encrypted with AES-256-GCM (format: ivHex:authTagHex:ciphertextHex)
  accessTokenEncrypted: string;
  // Refresh token encrypted the same way — stored for future use when auto-refresh is implemented
  refreshTokenEncrypted: string;
  // When the access token expires — used by isExpiringSoon() to decide if a refresh is needed
  expiresAt: Date;
  // Last time this student made a Canvas API call — used for the 30-day inactivity policy
  lastActiveAt: Date;
}

// TokenStore is an abstract class — it defines the storage contract but has no implementation.
// This allows swapping the storage backend (in-memory for development, database for production)
// by changing one line in the NestJS module without touching any other code.
export abstract class TokenStore {
  // Save or overwrite a token record for a student
  abstract save(record: EncryptedTokenRecord): Promise<void>;
  // Find a token record by Teams user ID — returns null if none exists
  abstract find(teamsUserId: string): Promise<EncryptedTokenRecord | null>;
  // Delete the token record for a student (used on sign-out or token revocation)
  abstract delete(teamsUserId: string): Promise<void>;
  // Delete all records where lastActiveAt is older than the cutoff date.
  // Returns the number of records removed — used to enforce the 30-day inactivity policy.
  abstract deleteOlderThan(cutoff: Date): Promise<number>;
}

// InMemoryTokenStore is the development implementation of TokenStore.
// Records are stored in a JavaScript Map (key = teamsUserId, value = EncryptedTokenRecord).
// This works fine for a single process but is NOT suitable for production:
// multiple server replicas each have their own Map, so tokens stored on one pod
// are invisible to the other pods.
export class InMemoryTokenStore extends TokenStore {
  // Map acts as the in-memory "database table" — keys are Teams user IDs
  private readonly records = new Map<string, EncryptedTokenRecord>();

  // Store or overwrite the record for this student
  save(record: EncryptedTokenRecord): Promise<void> {
    this.records.set(record.teamsUserId, record);
    return Promise.resolve();
  }

  // Look up the record by Teams user ID.
  // ?? null converts undefined (Map returns undefined for missing keys) to null for consistency.
  find(teamsUserId: string): Promise<EncryptedTokenRecord | null> {
    return Promise.resolve(this.records.get(teamsUserId) ?? null);
  }

  // Remove the record for this student from the Map
  delete(teamsUserId: string): Promise<void> {
    this.records.delete(teamsUserId);
    return Promise.resolve();
  }

  // Iterate all records and remove those whose lastActiveAt is before the cutoff date.
  // Returns how many records were deleted so the caller can log the cleanup result.
  deleteOlderThan(cutoff: Date): Promise<number> {
    let removed = 0;
    for (const [key, rec] of this.records) {
      if (rec.lastActiveAt < cutoff) {
        this.records.delete(key);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }
}
