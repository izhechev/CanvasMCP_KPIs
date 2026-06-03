import { randomBytes } from 'crypto';

// SessionStore maps a short-lived opaque session token to the Teams user ID of a
// student who has completed the Fontys OIDC login. The MCP server presents this
// token as a Bearer credential; the store resolves it back to the student ID so
// tools can look up the correct Canvas token.
export abstract class SessionStore {
  abstract create(teamsUserId: string): Promise<string>;
  abstract resolve(token: string): Promise<string | null>;
}

// Sessions live for 8 hours — long enough for a working day, short enough to limit
// exposure if a token leaks.
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

interface Entry {
  teamsUserId: string;
  expiresAt: number;
}

export class InMemorySessionStore extends SessionStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {
    super();
  }

  create(teamsUserId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    this.entries.set(token, {
      teamsUserId,
      expiresAt: Date.now() + this.ttlMs,
    });
    return Promise.resolve(token);
  }

  resolve(token: string): Promise<string | null> {
    const entry = this.entries.get(token);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(token);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.teamsUserId);
  }
}
