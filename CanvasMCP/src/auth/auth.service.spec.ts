import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { InMemoryOAuthStateStore, OAuthStateStore } from './oauth-state-store';
import { InMemoryAuthCodeStore, AuthCodeStore } from './auth-code-store';
import { InMemorySessionStore, SessionStore } from './session-store';
import { TokenService } from '../token/token.service';

// Mocks: tokenService (storeToken), ConfigService (get), global.fetch
const mockTokenService = {
  storeToken: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      FONTYS_ISSUER_URL: 'https://identity.fhict.nl',
      FONTYS_CLIENT_ID: 'test-client-id',
      FONTYS_CLIENT_SECRET: 'test-client-secret',
      FONTYS_REDIRECT_URI: 'http://localhost:3000/auth/canvas/callback',
      CANVAS_TEST_TOKEN: 'test-canvas-token',
    };
    return values[key] ?? '';
  }),
};

function makeService(): AuthService {
  return new AuthService(
    mockTokenService as unknown as TokenService,
    mockConfig as unknown as ConfigService,
    new InMemoryOAuthStateStore(),
    new InMemoryAuthCodeStore(),
    new InMemorySessionStore(),
  );
}

async function createService(): Promise<AuthService> {
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: TokenService, useValue: mockTokenService },
      { provide: ConfigService, useValue: mockConfig },
      { provide: OAuthStateStore, useClass: InMemoryOAuthStateStore },
      { provide: AuthCodeStore, useClass: InMemoryAuthCodeStore },
      { provide: SessionStore, useClass: InMemorySessionStore },
    ],
  }).compile();
  return module.get(AuthService);
}

// Build a minimal mock ID token (header.payload.signature)
function makeMockIdToken(sub: string, email = 'student@fontys.nl'): string {
  const header = Buffer.from('{"alg":"RS256","typ":"JWT"}').toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({ sub, email, name: 'Test Student' }),
  ).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

const fontysTokenResponse = {
  access_token: 'fontys-access-token',
  id_token: makeMockIdToken('i508447'),
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'openid profile email fhict fhict_personal',
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fontysTokenResponse),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateAuthUrl', () => {
    it('returns a URL pointing to Fontys OIDC authorize endpoint', async () => {
      const service = makeService();
      const url = await service.generateAuthUrl('teams-user-1');
      expect(url).toContain('https://identity.fhict.nl/connect/authorize');
    });

    it('includes required OIDC parameters', async () => {
      const service = makeService();
      const url = await service.generateAuthUrl('teams-user-1');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain(
        encodeURIComponent('http://localhost:3000/auth/canvas/callback'),
      );
      expect(url).toContain('openid');
    });

    it('includes a state parameter', async () => {
      const service = makeService();
      const url = await service.generateAuthUrl('teams-user-1');
      expect(url).toMatch(/state=[a-f0-9]+/);
    });

    it('generates a unique state per call', async () => {
      const service = makeService();
      const url1 = await service.generateAuthUrl('teams-user-1');
      const url2 = await service.generateAuthUrl('teams-user-2');
      const state1 = new URL(url1).searchParams.get('state');
      const state2 = new URL(url2).searchParams.get('state');
      expect(state1).not.toBe(state2);
    });

    it('includes PKCE code_challenge and code_challenge_method=S256', async () => {
      const service = makeService();
      const url = new URL(await service.generateAuthUrl('teams-user-1'));
      expect(url.searchParams.get('code_challenge')).toMatch(
        /^[A-Za-z0-9_-]{43,}$/,
      );
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('generates a unique code_challenge per call', async () => {
      const service = makeService();
      const url1 = new URL(await service.generateAuthUrl('teams-user-1'));
      const url2 = new URL(await service.generateAuthUrl('teams-user-2'));
      expect(url1.searchParams.get('code_challenge')).not.toBe(
        url2.searchParams.get('code_challenge'),
      );
    });
  });

  describe('handleCallback', () => {
    async function getState(promise: Promise<string>): Promise<string> {
      return new URL(await promise).searchParams.get('state')!;
    }

    it('stores the Canvas test token under the Teams user ID after Fontys login', async () => {
      const service = await createService();
      const state = await getState(service.generateAuthUrl('teams-user-1'));

      await service.handleCallback('auth-code-123', state);

      expect(mockTokenService.storeToken).toHaveBeenCalledWith('teams-user-1', {
        canvasUserId: 0,
        accessToken: 'test-canvas-token',
        refreshToken: '',
        expiresAt: expect.any(Date),
      });
    });

    it('POSTs to Fontys OIDC token endpoint with correct body', async () => {
      const service = await createService();
      const state = await getState(service.generateAuthUrl('teams-user-1'));

      await service.handleCallback('auth-code-123', state);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://identity.fhict.nl/connect/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=authorization_code'),
        }),
      );
    });

    it('includes code_verifier in token exchange body', async () => {
      const service = await createService();
      const state = await getState(service.generateAuthUrl('teams-user-1'));

      await service.handleCallback('auth-code-123', state);

      const body = (global.fetch as jest.Mock).mock.calls[0][1].body as string;
      expect(body).toContain('code_verifier=');
    });

    it('throws when state is unknown (CSRF protection)', async () => {
      const service = await createService();
      await expect(
        service.handleCallback('auth-code-123', 'unknown-state'),
      ).rejects.toThrow('Invalid or expired OAuth state');
    });

    it('state is one-time use — second call with same state throws', async () => {
      const service = await createService();
      const state = await getState(service.generateAuthUrl('teams-user-1'));

      await service.handleCallback('auth-code-123', state);
      await expect(
        service.handleCallback('auth-code-456', state),
      ).rejects.toThrow('Invalid or expired OAuth state');
    });

    it('throws when Fontys token exchange fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const service = await createService();
      const state = await getState(service.generateAuthUrl('teams-user-1'));

      await expect(
        service.handleCallback('auth-code-bad', state),
      ).rejects.toThrow('Canvas token exchange failed');
    });

    it('skips Canvas token storage when CANVAS_TEST_TOKEN is empty', async () => {
      const service = new AuthService(
        mockTokenService as unknown as TokenService,
        {
          get: jest.fn((key: string) => {
            if (key === 'CANVAS_TEST_TOKEN') return '';
            if (key === 'FONTYS_ISSUER_URL') return 'https://identity.fhict.nl';
            if (key === 'FONTYS_CLIENT_ID') return 'test-client-id';
            if (key === 'FONTYS_CLIENT_SECRET') return 'test-client-secret';
            if (key === 'FONTYS_REDIRECT_URI')
              return 'http://localhost:3000/auth/canvas/callback';
            return '';
          }),
        } as unknown as ConfigService,
        new InMemoryOAuthStateStore(),
        new InMemoryAuthCodeStore(),
        new InMemorySessionStore(),
      );
      const state = await getState(service.generateAuthUrl('u1'));
      await service.handleCallback('code', state);
      expect(mockTokenService.storeToken).not.toHaveBeenCalled();
    });
  });

  describe('exchangeAuthCode', () => {
    it('returns a session token for a valid auth code', async () => {
      const service = await createService();
      const state = new URL(
        await service.generateAuthUrl('u1'),
      ).searchParams.get('state')!;
      const { authCode } = await service.handleCallback('code-123', state);
      const token = await service.exchangeAuthCode(authCode);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('throws OAuthStateError for an invalid auth code', async () => {
      const service = await createService();
      await expect(service.exchangeAuthCode('bad-code')).rejects.toThrow(
        'Invalid or expired OAuth state',
      );
    });
  });
});
