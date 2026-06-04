import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MissingAccessTokenError } from '../common/errors';
import { encrypt, decrypt } from './token.crypto';
import { TokenStore } from './token-store';
import { StoreTokenInput, TokenRecord } from './interfaces/token.interface';

// How many milliseconds before expiry we consider a token "expiring soon".
// 5 minutes gives the system time to refresh the token before it actually expires.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// @Injectable() registers this class with NestJS Dependency Injection.
// NestJS will automatically create one instance and inject it wherever TokenService is requested.
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    // ConfigService reads environment variables from the .env file
    private readonly config: ConfigService,
    // TokenStore is injected as an abstract type — NestJS resolves it to InMemoryTokenStore
    // (or a future database implementation) based on the module binding
    private readonly store: TokenStore,
  ) {}

  // resolveToken is the single entry point for getting a Canvas bearer token for a student.
  // It follows a priority chain:
  //   1. If NODE_ENV is not production AND CANVAS_TEST_TOKEN is set → use the test token (dev shortcut)
  //   2. Otherwise → look up the encrypted record from the store, decrypt it, return the access token
  //   3. If no record exists → throw MissingAccessTokenError (student has not done OAuth yet)
  async resolveToken(studentId: string): Promise<string> {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const testToken = this.config.get<string>('CANVAS_TEST_TOKEN');

    // Development shortcut: skip the database lookup entirely.
    // CANVAS_TEST_TOKEN is blocked in production by the startup check in main.ts.
    if (nodeEnv !== 'production' && testToken) {
      this.logger.log(`Using CANVAS_TEST_TOKEN for student ${studentId}`);
      // trim() removes accidental whitespace; replace() strips a leading "Bearer " prefix
      // in case the env var was set with it included
      return testToken.trim().replace(/^Bearer\s+/i, '');
    }

    this.logger.log(`Using database token for student ${studentId}`);
    const token = await this.getAccessToken(studentId);
    return token.trim().replace(/^Bearer\s+/i, '');
  }

  // storeToken is called by AuthService after a successful OAuth token exchange.
  // It encrypts both tokens before saving so plaintext never touches the store.
  async storeToken(teamsUserId: string, input: StoreTokenInput): Promise<void> {
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY', '');
    await this.store.save({
      teamsUserId,
      canvasUserId: input.canvasUserId,
      // Encrypt access and refresh tokens with AES-256-GCM before saving
      accessTokenEncrypted: encrypt(input.accessToken, key),
      refreshTokenEncrypted: encrypt(input.refreshToken, key),
      expiresAt: input.expiresAt,
      // Record when this token was stored so the inactivity policy can be applied
      lastActiveAt: new Date(),
    });
  }

  // getToken returns the full decrypted token record for a student, or null if none exists.
  // Used internally and by callers that need more than just the access token.
  async getToken(teamsUserId: string): Promise<TokenRecord | null> {
    const rec = await this.store.find(teamsUserId);
    if (!rec) return null;
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY', '');
    return {
      teamsUserId: rec.teamsUserId,
      canvasUserId: rec.canvasUserId,
      // Decrypt both tokens on the way out — they were encrypted on the way in
      accessToken: decrypt(rec.accessTokenEncrypted, key),
      refreshToken: decrypt(rec.refreshTokenEncrypted, key),
      expiresAt: rec.expiresAt,
      lastActiveAt: rec.lastActiveAt,
    };
  }

  // getAccessToken returns just the decrypted access token string.
  // Throws MissingAccessTokenError if no record exists — the student must re-authorise.
  async getAccessToken(teamsUserId: string): Promise<string> {
    const rec = await this.getToken(teamsUserId);
    if (!rec) throw new MissingAccessTokenError(teamsUserId);
    return rec.accessToken;
  }

  // deleteToken removes the stored record for a student.
  // Called when a student revokes access or their session is invalidated.
  async deleteToken(teamsUserId: string): Promise<void> {
    await this.store.delete(teamsUserId);
  }

  // isExpiringSoon returns true if the access token will expire within the next 5 minutes.
  // The caller (not yet implemented) should trigger a refresh when this returns true.
  isExpiringSoon(record: TokenRecord): boolean {
    return record.expiresAt.getTime() - Date.now() < EXPIRY_BUFFER_MS;
  }
}
