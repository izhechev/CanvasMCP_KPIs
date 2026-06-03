import { fetchAllPages, fetchJson, HttpError } from './http.util';

// Mocks: global.fetch
// fetch is a built-in JavaScript function whose only job is to send an HTTP request
// to a URL and return the response. fetchJson wraps it to also parse the JSON body.
//
// global is the container Node.js uses to hold every built-in value available
// everywhere in your program — fetch, console, setTimeout, etc.
// Writing global.fetch and writing fetch refer to the exact same function.
// The explicit global. prefix is needed so Jest knows which object property to replace.
//
// During tests we do not want to send real HTTP requests to a live server.
// jest.spyOn(global, 'fetch') replaces the real fetch with a controlled substitute
// — the "fake fetch" — that returns whatever we tell it to via mockResolvedValue().
// The code under test calls fetch() as normal and cannot tell it is talking to the substitute.
//
// Why spyOn instead of just assigning a fake function directly?
// Three reasons:
//   1. spyOn saves the original fetch internally before replacing it,
//      so restoreAllMocks() can put it back after each test.
//      A direct assignment loses the original and you cannot restore it.
//   2. spyOn records every call — which arguments were passed, how many times it was called.
//      This lets us assert things like: "fetch was called with this exact URL and these headers."
//      A plain assigned function does not record anything.
//   3. We are testing fetchJson, not fetch. spyOn replaces only the external dependency
//      (fetch) while letting our own code (fetchJson) run for real.
//
// Flow in real app:  fetchJson() → fetch() → actual server  → real response
// Flow in tests:     fetchJson() → fetch() → Jest substitute → response we defined

describe('fetchJson', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns parsed JSON on a successful response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'test' }),
    });
    const result = await fetchJson<{ id: number; name: string }>(
      'https://example.com',
    );
    expect(result).toEqual({ id: 1, name: 'test' });
  });

  it('passes init options through to fetch', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await fetchJson('https://example.com', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
    expect(global.fetch).toHaveBeenCalledWith('https://example.com', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
  });

  // Three non-ok status codes — same pattern: mock a failed response, assert HttpError thrown
  it.each([
    [401, 'Unauthorized'],
    [500, 'Internal Server Error'],
    [429, 'Too Many Requests'],
  ])('throws HttpError for HTTP %i response', async (status, statusText) => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status,
      statusText,
    });
    let caught: unknown;
    try {
      await fetchJson('https://example.com');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HttpError);
    expect((caught as HttpError).status).toBe(status);
    expect((caught as HttpError).message).toContain(String(status));
  });
});

describe('fetchAllPages', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns all items from a single-page response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
      headers: { get: () => null },
    });
    const result = await fetchAllPages<{ id: number }>('https://example.com');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('follows Link header pagination across multiple pages', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 1 }]),
        headers: {
          get: () => '<https://example.com?page=2>; rel="next"',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 2 }]),
        headers: { get: () => null },
      });

    const result = await fetchAllPages<{ id: number }>('https://example.com');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com?page=2',
      undefined,
    );
  });

  it('throws HttpError on a non-ok page response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await expect(fetchAllPages('https://example.com')).rejects.toThrow('403');
  });

  it('ignores Link parts that are not rel="next"', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }]),
      headers: {
        get: () =>
          '<https://example.com?page=1>; rel="prev", <https://example.com?page=1>; rel="first"',
      },
    });
    const result = await fetchAllPages<{ id: number }>('https://example.com');
    expect(result).toEqual([{ id: 1 }]);
  });
});
