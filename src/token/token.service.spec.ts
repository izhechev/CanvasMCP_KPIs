import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { InMemoryTokenStore, TokenStore } from './token-store';

// Mocks: ConfigService (get), TokenStore (InMemoryTokenStore — real implementation)
const VALID_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

async function createService(encryptionKey = VALID_KEY): Promise<TokenService> {
  const module = await Test.createTestingModule({
    providers: [
      TokenService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(encryptionKey) },
      },
      { provide: TokenStore, useClass: InMemoryTokenStore },
    ],
  }).compile();
  return module.get(TokenService);
}

const sampleInput = {
  canvasUserId: 12345,
  accessToken: 'canvas-access-token-abc',
  refreshToken: 'canvas-refresh-token-xyz',
  expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
};

describe('TokenService', () => {
  describe('storeToken / getToken', () => {
    it('returns decrypted tokens matching what was stored', async () => {
      const service = await createService();
      await service.storeToken('teams-user-1', sampleInput);
      const record = await service.getToken('teams-user-1');

      expect(record?.accessToken).toBe('canvas-access-token-abc');
      expect(record?.refreshToken).toBe('canvas-refresh-token-xyz');
      expect(record?.canvasUserId).toBe(12345);
      expect(record?.expiresAt).toEqual(sampleInput.expiresAt);
    });

    it('returns null for unknown user', async () => {
      const service = await createService();
      const record = await service.getToken('nobody');
      expect(record).toBeNull();
    });

    it('overwrites existing record when storing for the same user again', async () => {
      const service = await createService();
      await service.storeToken('teams-user-1', sampleInput);
      await service.storeToken('teams-user-1', {
        ...sampleInput,
        accessToken: 'new-token',
      });
      const record = await service.getToken('teams-user-1');
      expect(record?.accessToken).toBe('new-token');
    });

    it('sets lastActiveAt to approximately now when storing', async () => {
      const service = await createService();
      const before = Date.now();
      await service.storeToken('teams-user-1', sampleInput);
      const record = await service.getToken('teams-user-1');
      expect(record?.lastActiveAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(record?.lastActiveAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('stores records for multiple users independently', async () => {
      const service = await createService();
      await service.storeToken('user-a', {
        ...sampleInput,
        accessToken: 'token-a',
      });
      await service.storeToken('user-b', {
        ...sampleInput,
        accessToken: 'token-b',
      });

      expect((await service.getToken('user-a'))?.accessToken).toBe('token-a');
      expect((await service.getToken('user-b'))?.accessToken).toBe('token-b');
    });
  });

  describe('deleteToken', () => {
    it('removes the record so getToken returns null', async () => {
      const service = await createService();
      await service.storeToken('teams-user-1', sampleInput);
      await service.deleteToken('teams-user-1');
      expect(await service.getToken('teams-user-1')).toBeNull();
    });

    it('is a no-op for an unknown user', async () => {
      const service = await createService();
      await expect(service.deleteToken('nobody')).resolves.toBeUndefined();
    });
  });

  describe('getAccessToken', () => {
    it('returns the decrypted access token for a stored user', async () => {
      const service = await createService();
      await service.storeToken('teams-user-1', sampleInput);
      expect(await service.getAccessToken('teams-user-1')).toBe(
        'canvas-access-token-abc',
      );
    });

    it('throws MissingAccessTokenError when no record exists', async () => {
      const service = await createService();
      await expect(service.getAccessToken('nobody')).rejects.toThrow(
        'No Canvas access token',
      );
    });
  });

  describe('isExpiringSoon', () => {
    it.each<[string, number, boolean]>([
      [
        'returns false when token expires in more than 5 minutes',
        3600 * 1000,
        false,
      ],
      [
        'returns true when token expires in less than 5 minutes',
        4 * 60 * 1000,
        true,
      ],
      ['returns true for an already expired token', -1000, true],
    ])('%s', async (_label: string, expiresInMs: number, expected: boolean) => {
      const service = await createService();
      const expiresAt = new Date(Date.now() + expiresInMs);
      await service.storeToken('teams-user-1', { ...sampleInput, expiresAt });
      const record = await service.getToken('teams-user-1');
      expect(service.isExpiringSoon(record!)).toBe(expected);
    });
  });

  describe('resolveToken', () => {
    it.each<[string, string, string | undefined, boolean, string]>([
      [
        'returns CANVAS_TEST_TOKEN when not in production and token is set',
        'development',
        'test-token',
        false,
        'test-token',
      ],
      [
        'returns database token when in production',
        'production',
        'test-token',
        true,
        'canvas-access-token-abc',
      ],
      [
        'returns database token when CANVAS_TEST_TOKEN is missing',
        'development',
        undefined,
        true,
        'canvas-access-token-abc',
      ],
    ])('%s', async (_label, nodeEnv, testToken, storeFirst, expected) => {
      const module = await Test.createTestingModule({
        providers: [
          TokenService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'NODE_ENV') return nodeEnv;
                if (key === 'CANVAS_TEST_TOKEN') return testToken;
                return VALID_KEY;
              }),
            },
          },
          { provide: TokenStore, useClass: InMemoryTokenStore },
        ],
      }).compile();
      const service = module.get(TokenService);
      if (storeFirst) await service.storeToken('student-1', sampleInput);
      expect(await service.resolveToken('student-1')).toBe(expected);
    });
  });

  describe('error handling', () => {
    it('throws when TOKEN_ENCRYPTION_KEY is not configured', async () => {
      const service = await createService('');
      await expect(
        service.storeToken('teams-user-1', sampleInput),
      ).rejects.toThrow('TOKEN_ENCRYPTION_KEY');
    });
  });
});
