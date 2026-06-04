import request from 'supertest';
import type { Server } from 'http';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionStore } from './session-store';

// Mocks: authService (generateAuthUrl, handleCallback, exchangeAuthCode), tokenService (storeToken), sessionStore (create, resolve)
const mockAuthService = {
  generateAuthUrl: jest
    .fn()
    .mockResolvedValue('https://canvas.example.com/oauth?state=abc'),
  handleCallback: jest.fn().mockResolvedValue({
    returnTo: undefined,
    authCode: 'test-auth-code',
  }),
  exchangeAuthCode: jest.fn().mockResolvedValue('test-session-token'),
};

const mockTokenService = {
  storeToken: jest.fn().mockResolvedValue(undefined),
};

const mockSessionStore = {
  create: jest.fn().mockResolvedValue('test-session-token'),
  resolve: jest.fn().mockResolvedValue(null),
};

async function createApp(nodeEnv = 'test'): Promise<INestApplication> {
  process.env.NODE_ENV = nodeEnv;
  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: mockAuthService },
      { provide: TokenService, useValue: mockTokenService },
      { provide: SessionStore, useValue: mockSessionStore },
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  return app;
}

function server(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

describe('AuthController', () => {
  let app: INestApplication;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.CANVAS_TEST_TOKEN;
    if (app) {
      await app.close();
    }
  });

  // ─── GET /auth/login ──────────────────────────────────────────────────────

  describe('GET /auth/login', () => {
    it('returns HTML containing the heading "Connect Canvas to Teams"', async () => {
      app = await createApp();
      const res = await request(server(app)).get('/auth/login');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Connect Canvas to Teams');
    });

    it('button href points at /auth/canvas', async () => {
      app = await createApp();
      const res = await request(server(app)).get('/auth/login');
      expect(res.text).toContain('href="/auth/canvas"');
    });

    it('button href includes returnTo when provided', async () => {
      app = await createApp();
      const res = await request(server(app)).get(
        '/auth/login?returnTo=user%40fontys.nl',
      );
      expect(res.text).toContain('returnTo=');
      expect(res.text).toContain('/auth/canvas');
    });

    it('button href does NOT include returnTo when not provided', async () => {
      app = await createApp();
      const res = await request(server(app)).get('/auth/login');
      expect(res.text).not.toContain('returnTo=');
    });

    it('button href includes teamsUserId when provided', async () => {
      app = await createApp();
      const res = await request(server(app)).get(
        '/auth/login?teamsUserId=teams-abc',
      );
      expect(res.text).toContain('teamsUserId=teams-abc');
    });
  });

  // ─── GET /auth/canvas ─────────────────────────────────────────────────────

  describe('GET /auth/canvas', () => {
    it('passes returnTo to generateAuthUrl when provided', async () => {
      app = await createApp();
      await request(server(app)).get(
        '/auth/canvas?teamsUserId=u1&returnTo=user%40fontys.nl',
      );
      expect(mockAuthService.generateAuthUrl).toHaveBeenCalledWith(
        'u1',
        'user@fontys.nl',
      );
    });

    it('passes undefined for returnTo when not provided', async () => {
      app = await createApp();
      await request(server(app)).get('/auth/canvas?teamsUserId=u1');
      expect(mockAuthService.generateAuthUrl).toHaveBeenCalledWith(
        'u1',
        undefined,
      );
    });

    it('returns 404 in production', async () => {
      app = await createApp('production');
      const res = await request(server(app)).get('/auth/canvas?teamsUserId=u1');
      expect(res.status).toBe(404);
    });

    it('returns 400 when teamsUserId is missing', async () => {
      app = await createApp();
      const res = await request(server(app)).get('/auth/canvas');
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /auth/canvas/callback ────────────────────────────────────────────

  describe('GET /auth/canvas/callback', () => {
    it('redirects to Teams deep link when returnTo is not a valid URL', async () => {
      app = await createApp();
      mockAuthService.handleCallback.mockResolvedValueOnce({
        returnTo: 'user@fontys.nl',
        authCode: 'test-auth-code',
      });
      const res = await request(server(app)).get(
        '/auth/canvas/callback?code=abc&state=xyz',
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('teams.microsoft.com');
    });

    it('appends auth code as search param when returnTo is a valid URL', async () => {
      app = await createApp();
      mockAuthService.handleCallback.mockResolvedValueOnce({
        returnTo: 'https://teams.microsoft.com/l/chat/0/0?users=test',
        authCode: 'my-auth-code',
      });
      const res = await request(server(app)).get(
        '/auth/canvas/callback?code=abc&state=xyz',
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('code=my-auth-code');
      expect(res.headers.location).toContain('teams.microsoft.com');
    });

    it('renders fallback HTML containing "connected" when returnTo is absent', async () => {
      app = await createApp();
      mockAuthService.handleCallback.mockResolvedValueOnce({
        returnTo: undefined,
        authCode: 'test-auth-code',
      });
      const res = await request(server(app)).get(
        '/auth/canvas/callback?code=abc&state=xyz',
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text.toLowerCase()).toMatch(/connected|teams/);
    });

    it('returns 400 plain-text when error query param is set', async () => {
      app = await createApp();
      const res = await request(server(app)).get(
        '/auth/canvas/callback?error=access_denied',
      );
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toContain('access_denied');
    });

    it('returns 400 plain-text with error_description when provided', async () => {
      app = await createApp();
      const res = await request(server(app)).get(
        '/auth/canvas/callback?error=access_denied&error_description=User+denied+access',
      );
      expect(res.status).toBe(400);
      expect(res.text).toContain('User denied access');
    });

    it('returns 400 when code is missing from callback', async () => {
      app = await createApp();
      const res = await request(server(app)).get(
        '/auth/canvas/callback?state=xyz',
      );
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /auth/token ─────────────────────────────────────────────────────

  describe('POST /auth/token', () => {
    it('returns { token } when the auth code is valid', async () => {
      app = await createApp();
      const res = await request(server(app))
        .post('/auth/token')
        .send({ code: 'valid-auth-code' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ token: 'test-session-token' });
    });

    it('returns 400 when code is missing from body', async () => {
      app = await createApp();
      const res = await request(server(app)).post('/auth/token').send({});
      expect(res.status).toBe(400);
    });

    it('returns 401 when exchangeAuthCode throws', async () => {
      app = await createApp();
      mockAuthService.exchangeAuthCode.mockRejectedValueOnce(
        new Error('invalid'),
      );
      const res = await request(server(app))
        .post('/auth/token')
        .send({ code: 'bad-code' });
      expect(res.status).toBe(401);
    });
  });

  // ─── Dev demo path ────────────────────────────────────────────────────────

  describe('GET /auth/login — dev demo path', () => {
    it('calls storeToken with devStudentId and redirects when returnTo present', async () => {
      process.env.CANVAS_TEST_TOKEN = 'test-token-abc';
      app = await createApp('test');
      const res = await request(server(app)).get(
        '/auth/login?devStudentId=student-1&returnTo=user%40fontys.nl',
      );
      expect(mockTokenService.storeToken).toHaveBeenCalledWith(
        'student-1',
        expect.objectContaining({ accessToken: 'test-token-abc' }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('teams.microsoft.com');
    });

    it('calls storeToken and shows connected HTML when no returnTo', async () => {
      process.env.CANVAS_TEST_TOKEN = 'test-token-abc';
      app = await createApp('test');
      const res = await request(server(app)).get(
        '/auth/login?devStudentId=student-1',
      );
      expect(mockTokenService.storeToken).toHaveBeenCalledWith(
        'student-1',
        expect.objectContaining({ accessToken: 'test-token-abc' }),
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text.toLowerCase()).toMatch(/connected|teams/);
    });

    it.each<[string, string, string | undefined, string]>([
      [
        'production gate',
        'production',
        'test-token-abc',
        '/auth/login?devStudentId=student-1&returnTo=user%40fontys.nl',
      ],
      [
        'devStudentId set but CANVAS_TEST_TOKEN missing',
        'test',
        undefined,
        '/auth/login?devStudentId=student-1',
      ],
      [
        'CANVAS_TEST_TOKEN set but devStudentId missing',
        'test',
        'test-token-abc',
        '/auth/login',
      ],
    ])(
      'falls through to HTML form: %s',
      async (
        _label: string,
        nodeEnv: string,
        testToken: string | undefined,
        url: string,
      ) => {
        if (testToken !== undefined) process.env.CANVAS_TEST_TOKEN = testToken;
        app = await createApp(nodeEnv);
        const res = await request(server(app)).get(url);
        expect(mockTokenService.storeToken).not.toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.text).toContain('Connect Canvas to Teams');
      },
    );
  });
});
