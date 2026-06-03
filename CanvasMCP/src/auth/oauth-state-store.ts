import { AppError } from '../common/errors';

// OAuthStatePayload is what we store for each in-flight OAuth login attempt.
// Both fields are needed to complete the OAuth flow when Canvas redirects back.
export interface OAuthStatePayload {
  // The Microsoft Teams user ID — so we know whose token to save after OAuth succeeds
  teamsUserId: string;
  // The PKCE code verifier — must be sent to Canvas during the token exchange to prove
  // we are the same party that started the flow (prevents authorization code interception)
  codeVerifier: string;
  // Optional URL to redirect the student back to after a successful OAuth login.
  // Currently used to return them to their Microsoft Teams chat.
  returnTo?: string;
}

// OAuthStateStore defines the contract for storing one-time OAuth state values.
// Abstract class means it cannot be instantiated directly — only InMemoryOAuthStateStore
// (or a future database implementation) can be used.
// This pattern allows swapping storage backends without changing AuthService.
export abstract class OAuthStateStore {
  // put saves a state value with its payload — called when the student clicks "Connect Canvas"
  abstract put(state: string, payload: OAuthStatePayload): Promise<void>;
  // consume retrieves AND deletes the payload for a state value — called on the OAuth callback.
  // One-time use: calling consume twice with the same state returns null the second time.
  // This prevents CSRF replay attacks where an attacker reuses a captured callback URL.
  abstract consume(state: string): Promise<OAuthStatePayload | null>;
}

// State entries expire after 10 minutes — enough time for a student to complete the Canvas login
const DEFAULT_TTL_MS = 10 * 60 * 1000;

// Hard cap on how many in-flight OAuth sessions can exist at once.
// Without a cap, an attacker could flood the /auth/canvas endpoint with requests
// to exhaust server memory. At 500, put() starts rejecting with HTTP 503.
const DEFAULT_MAX_SIZE = 500;

// InMemoryEntry wraps the payload with an expiry timestamp for TTL enforcement.
interface InMemoryEntry {
  payload: OAuthStatePayload;
  // Unix timestamp (ms) after which this entry is considered expired
  expiresAt: number;
}

// InMemoryOAuthStateStore is the concrete implementation using a JavaScript Map.
// TTL and max size are configurable so tests can use short TTLs to verify expiry behaviour.
export class InMemoryOAuthStateStore extends OAuthStateStore {
  // Map<state string, entry> — the state string is a random hex value generated per OAuth attempt
  private readonly entries = new Map<string, InMemoryEntry>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly maxSize: number = DEFAULT_MAX_SIZE,
  ) {
    super();
  }

  put(state: string, payload: OAuthStatePayload): Promise<void> {
    // Evict expired entries first to keep the store lean
    this.evictExpired();

    // Reject if at capacity — 503 Service Unavailable signals the server is temporarily unable
    // to handle more OAuth sessions (intentional rate-limiting, not a bug)
    if (this.entries.size >= this.maxSize) {
      return Promise.reject(new AppError('OAuth state store at capacity', 503));
    }

    // Store the state with an expiry timestamp calculated from now + TTL
    this.entries.set(state, {
      payload,
      expiresAt: Date.now() + this.ttlMs,
    });
    return Promise.resolve();
  }

  consume(state: string): Promise<OAuthStatePayload | null> {
    // Evict expired entries on every access to keep the store clean
    this.evictExpired();

    const entry = this.entries.get(state);
    // If state is unknown, return null — AuthService will throw OAuthStateError
    if (!entry) return Promise.resolve(null);

    // Delete IMMEDIATELY on first read — this is what makes it one-time use
    this.entries.delete(state);

    // Double-check expiry in case evictExpired() missed a race condition
    if (entry.expiresAt <= Date.now()) return Promise.resolve(null);

    return Promise.resolve(entry.payload);
  }

  // evictExpired scans all entries and removes those past their expiry time.
  // Called on every put() and consume() — no background timer needed.
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
