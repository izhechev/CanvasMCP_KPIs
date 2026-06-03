import { InMemorySessionStore } from './session-store';

// Mocks: none — uses real InMemorySessionStore
describe('InMemorySessionStore', () => {
  it('create returns a 64-char hex token', async () => {
    const store = new InMemorySessionStore();
    const token = await store.create('user-1');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('resolve returns the teamsUserId for a valid token', async () => {
    const store = new InMemorySessionStore();
    const token = await store.create('user-1');
    expect(await store.resolve(token)).toBe('user-1');
  });

  it('resolve returns null for an unknown token', async () => {
    const store = new InMemorySessionStore();
    expect(await store.resolve('not-a-real-token')).toBeNull();
  });

  it('resolve returns null after TTL expires', async () => {
    const store = new InMemorySessionStore(10); // 10 ms TTL
    const token = await store.create('user-1');
    await new Promise((r) => setTimeout(r, 20));
    expect(await store.resolve(token)).toBeNull();
  });

  it('resolve removes expired entry on access', async () => {
    const store = new InMemorySessionStore(10);
    const token = await store.create('user-1');
    await new Promise((r) => setTimeout(r, 20));
    await store.resolve(token); // triggers delete
    expect(await store.resolve(token)).toBeNull();
  });
});
