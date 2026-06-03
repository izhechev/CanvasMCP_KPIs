import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { OAuthStateError, TokenExchangeError } from '../common/errors';
import { fetchJson } from '../common/http.util';
import { TokenService } from '../token/token.service';
import { OAuthStateStore } from './oauth-state-store';
import { AuthCodeStore } from './auth-code-store';
import { SessionStore } from './session-store';

// Shape of the token response from identity.fhict.nl
interface FontysTokenResponse {
  access_token: string;
  // JWT containing the student's identity claims (sub, email, name, etc.)
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

// Decoded payload from the Fontys ID token JWT
interface FontysIdTokenClaims {
  // Fontys subject identifier (Fontys student number, e.g. "i508447")
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    private readonly stateStore: OAuthStateStore,
    private readonly authCodeStore: AuthCodeStore,
    private readonly sessionStore: SessionStore,
  ) {}

  async generateAuthUrl(
    teamsUserId: string,
    returnTo?: string,
  ): Promise<string> {
    const state = randomBytes(16).toString('hex');

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    await this.stateStore.put(state, { teamsUserId, codeVerifier, returnTo });

    const issuerUrl = this.config.get<string>('FONTYS_ISSUER_URL', '');
    const clientId = this.config.get<string>('FONTYS_CLIENT_ID', '');
    const redirectUri = this.config.get<string>('FONTYS_REDIRECT_URI', '');

    const url = new URL(`${issuerUrl}/connect/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'openid profile email');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return url.toString();
  }

  // handleCallback exchanges the Fontys authorization code, identifies the student,
  // stores their Canvas token, and issues a short-lived one-time auth code.
  // The auth code (not the session token) is embedded in the redirect URL.
  // The bot exchanges it for a session token via POST /auth/token — token never in URL.
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ returnTo?: string; authCode: string }> {
    const payload = await this.stateStore.consume(state);
    if (!payload) throw new OAuthStateError();

    const { teamsUserId, codeVerifier, returnTo } = payload;

    const issuerUrl = this.config.get<string>('FONTYS_ISSUER_URL', '');
    const clientId = this.config.get<string>('FONTYS_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('FONTYS_CLIENT_SECRET', '');
    const redirectUri = this.config.get<string>('FONTYS_REDIRECT_URI', '');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    // Fontys identity server expects client credentials as HTTP Basic Auth,
    // not in the request body (RFC 6749 §2.3.1 client_secret_basic method).
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    let tokens: FontysTokenResponse;
    try {
      tokens = await fetchJson<FontysTokenResponse>(
        `${issuerUrl}/connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`,
          },
          body: body.toString(),
        },
      );
    } catch (err) {
      this.logger.error('Fontys token exchange failed', err);
      throw new TokenExchangeError(err);
    }

    const [, payloadB64] = tokens.id_token.split('.');
    const claims = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as FontysIdTokenClaims;

    this.logger.log(
      `Fontys OIDC: student ${claims.sub} (${claims.email ?? 'no email'}) authenticated`,
    );

    // Temporary bridge: store the shared Canvas test token under the student's Teams user ID.
    // Replace this block with a real Canvas token exchange once the key is available.
    const testToken = this.config.get<string>('CANVAS_TEST_TOKEN', '').trim();
    if (testToken) {
      await this.tokenService.storeToken(teamsUserId, {
        canvasUserId: 0,
        accessToken: testToken,
        refreshToken: '',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    } else {
      this.logger.warn(
        `CANVAS_TEST_TOKEN not set — no Canvas token stored for ${teamsUserId}. ` +
          'MCP tools will fall back to the in-memory shortcut in dev mode.',
      );
    }

    // Issue a short-lived one-time auth code to put in the redirect URL.
    // The bot exchanges this for a session token via POST /auth/token.
    // The session token itself never appears in any URL.
    const authCode = await this.authCodeStore.create(teamsUserId);
    this.logger.log(`Auth code issued for ${teamsUserId}`);

    return { returnTo, authCode };
  }

  // exchangeAuthCode validates a one-time auth code and returns a long-lived session token.
  // Called server-to-server by the Teams bot after receiving the auth code from the redirect URL.
  async exchangeAuthCode(authCode: string): Promise<string> {
    const teamsUserId = await this.authCodeStore.consume(authCode);
    if (!teamsUserId) throw new OAuthStateError();

    const sessionToken = await this.sessionStore.create(teamsUserId);
    this.logger.log(`Session token issued for ${teamsUserId}`);
    return sessionToken;
  }
}
