import { InMemoryOAuthStateStore } from './oauth-state-store';

// Mocks: none — uses real InMemoryOAuthStateStore
describe('InMemoryOAuthStateStore', () => {
  const payload = (id: string) => ({
    teamsUserId: id,
    codeVerifier: `verifier-${id}`,
  });

  it('returns null for unknown state', async () => {
    const store = new InMemoryOAuthStateStore();
    expect(await store.consume('missing')).toBeNull();
  });

  it('returns payload for stored state', async () => {
    const store = new InMemoryOAuthStateStore();
    await store.put('s1', payload('user-1'));
    expect(await store.consume('s1')).toEqual(payload('user-1'));
  });

  it('consume is one-time — second call returns null', async () => {
    const store = new InMemoryOAuthStateStore();
    await store.put('s1', payload('user-1'));
    await store.consume('s1');
    expect(await store.consume('s1')).toBeNull();
  });

  it('expires entries after TTL', async () => {
    const store = new InMemoryOAuthStateStore(10);
    await store.put('s1', payload('user-1'));
    await new Promise((r) => setTimeout(r, 20));
    expect(await store.consume('s1')).toBeNull();
  });

  it('throws when capacity is exceeded', async () => {
    const store = new InMemoryOAuthStateStore(60_000, 2);
    await store.put('s1', payload('u1'));
    await store.put('s2', payload('u2'));
    await expect(store.put('s3', payload('u3'))).rejects.toThrow(
      'OAuth state store at capacity',
    );
  });

  it('frees capacity by evicting expired entries on put', async () => {
    const store = new InMemoryOAuthStateStore(10, 2);
    await store.put('s1', payload('u1'));
    await store.put('s2', payload('u2'));
    await new Promise((r) => setTimeout(r, 20));
    await expect(store.put('s3', payload('u3'))).resolves.toBeUndefined();
    expect(await store.consume('s3')).toEqual(payload('u3'));
  });

  it('round-trips returnTo through put and consume', async () => {
    const store = new InMemoryOAuthStateStore();
    const payloadWithReturnTo = {
      ...payload('user-rt'),
      returnTo: 'https://teams.microsoft.com/l/chat/123',
    };
    await store.put('s-rt', payloadWithReturnTo);
    expect(await store.consume('s-rt')).toEqual(payloadWithReturnTo);
  });

  it('returnTo is absent when not provided', async () => {
    const store = new InMemoryOAuthStateStore();
    await store.put('s-no-rt', payload('user-no-rt'));
    const result = await store.consume('s-no-rt');
    expect(result).not.toBeNull();
    expect(result!.returnTo).toBeUndefined();
  });
});
