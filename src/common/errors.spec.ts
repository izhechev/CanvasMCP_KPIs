import {
  AppError,
  CanvasAuthError,
  CanvasRateLimitError,
  InvalidEncryptionKeyError,
  MissingAccessTokenError,
  OAuthStateError,
  TokenExchangeError,
} from './errors';

// Mocks: none — pure unit tests
describe('Domain errors', () => {
  // ─── Shared properties across all AppError subclasses ────────────────────
  // Each row: [className, factory, httpStatus, expectedMessageSubstring]
  describe.each<[string, () => AppError, number, string]>([
    [
      'OAuthStateError',
      () => new OAuthStateError(),
      400,
      'Invalid or expired OAuth state',
    ],
    [
      'TokenExchangeError',
      () => new TokenExchangeError(new Error('x')),
      401,
      'Canvas token exchange failed',
    ],
    [
      'CanvasRateLimitError',
      () => new CanvasRateLimitError(),
      429,
      'Canvas rate limit (HTTP 429)',
    ],
    [
      'CanvasAuthError',
      () => new CanvasAuthError(),
      403,
      'Canvas auth error (HTTP 403)',
    ],
    [
      'MissingAccessTokenError',
      () => new MissingAccessTokenError('user-1'),
      401,
      'No Canvas access token',
    ],
    [
      'InvalidEncryptionKeyError',
      () => new InvalidEncryptionKeyError(0),
      500,
      'TOKEN_ENCRYPTION_KEY',
    ],
  ])('%s', (_name, make, httpStatus, messageContains) => {
    it('is instanceof AppError', () => expect(make()).toBeInstanceOf(AppError));
    it('has correct HTTP status', () => expect(make().status).toBe(httpStatus));
    it('message contains expected text', () =>
      expect(make().message).toContain(messageContains));
  });

  // ─── AppError base ────────────────────────────────────────────────────────
  describe('AppError', () => {
    it('sets name to subclass name', () => {
      expect(new OAuthStateError().name).toBe('OAuthStateError');
    });

    it('is instanceof Error', () => {
      expect(new OAuthStateError()).toBeInstanceOf(Error);
    });
  });

  // ─── Class-specific tests ─────────────────────────────────────────────────
  describe('TokenExchangeError', () => {
    it('stores the original error as cause', () => {
      const upstream = new Error('HTTP 401 Unauthorized');
      expect(new TokenExchangeError(upstream).cause).toBe(upstream);
    });
  });

  describe('CanvasRateLimitError', () => {
    it('stores cause when provided', () => {
      const cause = new Error('upstream');
      expect(new CanvasRateLimitError(cause).cause).toBe(cause);
    });
  });

  describe('CanvasAuthError', () => {
    it('stores cause when provided', () => {
      const cause = new Error('upstream');
      expect(new CanvasAuthError(cause).cause).toBe(cause);
    });
  });

  describe('MissingAccessTokenError', () => {
    it('includes studentId in message', () => {
      expect(new MissingAccessTokenError('user-1').message).toContain('user-1');
    });

    it('exposes studentId property', () => {
      expect(new MissingAccessTokenError('user-1').studentId).toBe('user-1');
    });
  });

  describe('InvalidEncryptionKeyError', () => {
    it('message includes the received key length', () => {
      expect(new InvalidEncryptionKeyError(10).message).toContain('10');
    });
  });
});
