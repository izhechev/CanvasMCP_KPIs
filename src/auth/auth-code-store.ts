import { randomBytes } from 'crypto';

// AuthCodeStore holds short-lived one-time codes issued after a successful Fontys login.
// The code is sent in the redirect URL; the real session token is never put in a URL.
// The bot exchanges the code for a session token via POST /auth/token (server-to-server).
export abstract class AuthCodeStore {
  abstract create(teamsUserId: string): Promise<string>;
  // consume deletes the code on read — one-time use prevents replay attacks.
  abstract consume(code: string): Promise<string | null>;
}

// Auth codes expire after 5 minutes — enough for the bot to make the exchange call.
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface Entry {
  teamsUserId: string;
  expiresAt: number;
}

export class InMemoryAuthCodeStore extends AuthCodeStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {
    super();
  }

  create(teamsUserId: string): Promise<string> {
    const code = randomBytes(32).toString('hex');
    this.entries.set(code, {
      teamsUserId,
      expiresAt: Date.now() + this.ttlMs,
    });
    return Promise.resolve(code);
  }

  consume(code: string): Promise<string | null> {
    const entry = this.entries.get(code);
    if (!entry) return Promise.resolve(null);
    this.entries.delete(code);
    if (entry.expiresAt <= Date.now()) return Promise.resolve(null);
    return Promise.resolve(entry.teamsUserId);
  }
}
