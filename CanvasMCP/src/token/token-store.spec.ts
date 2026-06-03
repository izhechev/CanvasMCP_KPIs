import { EncryptedTokenRecord, InMemoryTokenStore } from './token-store';

// Mocks: none — uses real InMemoryTokenStore
function record(
  teamsUserId: string,
  lastActiveAt = new Date(),
): EncryptedTokenRecord {
  return {
    teamsUserId,
    canvasUserId: 1,
    accessTokenEncrypted: 'enc-access',
    refreshTokenEncrypted: 'enc-refresh',
    expiresAt: new Date(Date.now() + 60_000),
    lastActiveAt,
  };
}

describe('InMemoryTokenStore', () => {
  it('returns null for unknown user', async () => {
    const store = new InMemoryTokenStore();
    expect(await store.find('nobody')).toBeNull();
  });

  it('returns the saved record', async () => {
    const store = new InMemoryTokenStore();
    await store.save(record('user-1'));
    expect((await store.find('user-1'))?.teamsUserId).toBe('user-1');
  });

  it('overwrites on save with the same key', async () => {
    const store = new InMemoryTokenStore();
    await store.save({ ...record('user-1'), accessTokenEncrypted: 'first' });
    await store.save({ ...record('user-1'), accessTokenEncrypted: 'second' });
    expect((await store.find('user-1'))?.accessTokenEncrypted).toBe('second');
  });

  it('delete removes the record', async () => {
    const store = new InMemoryTokenStore();
    await store.save(record('user-1'));
    await store.delete('user-1');
    expect(await store.find('user-1')).toBeNull();
  });

  it('deleteOlderThan removes records with lastActiveAt before cutoff', async () => {
    const store = new InMemoryTokenStore();
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const fresh = new Date();
    await store.save(record('old-user', old));
    await store.save(record('fresh-user', fresh));

    const removed = await store.deleteOlderThan(
      new Date(Date.now() - 30 * 60 * 1000),
    );
    expect(removed).toBe(1);
    expect(await store.find('old-user')).toBeNull();
    expect(await store.find('fresh-user')).not.toBeNull();
  });
});
