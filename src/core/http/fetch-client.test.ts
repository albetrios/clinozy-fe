import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HTTP } from '@/core/config/constants.ts';
import { clearAccessToken, setAccessToken } from '@/shared/auth/token.ts';
import { HttpError, isUnauthorized } from '@/shared/errors/HttpError.ts';

// Full stub — no importOriginal. service.ts sits in an import cycle with this
// module (service → queryClient → fetch-client → service), and importOriginal
// would evaluate that cycle while the mock factory is still running, handing
// fetch-client the REAL forceLogout instead of the stub. With a plain factory
// the mock exists before fetch-client evaluates. The single-flight network
// behaviour of refreshAccessToken is service's contract, proven in
// shared/auth/service.test.ts — here we only assert fetch-client DELEGATES.
vi.mock('@/shared/auth/service.ts', () => ({
  endRefusedSession: vi.fn(),
  forceLogout: vi.fn(),
  isRefreshUnanswered: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
import {
  endRefusedSession,
  forceLogout,
  isRefreshUnanswered,
  refreshAccessToken,
} from '@/shared/auth/service.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';

import { apiClient, setWriteHold } from './fetch-client.ts';

/** Helper to create a base64url-encoded JWT */
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/={1,2}$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.dGVzdHNpZw`;
}

const VALID_TOKEN = makeJwt({ sub: 'user1', exp: 9999999999 });

/** Shared response fixtures (module-scoped so blocks don't duplicate them). */
const ok = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const unauthorized = () =>
  new Response(JSON.stringify({ message: 'expired' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

describe('fetch-client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  describe('apiClient.get', () => {
    it('returns parsed JSON data on 200', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ foo: 'bar' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { data } = await apiClient.get<{ foo: string }>('/test');
      expect(data).toEqual({ foo: 'bar' });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('throws HttpError on non-2xx', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not found' }), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      let err: unknown;
      try {
        await apiClient.get('/test');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(404);
      expect((err as HttpError).data).toEqual({ message: 'Not found' });
    });
  });

  describe('clinozy-be { data, meta } envelope', () => {
    it('unwraps the envelope to the payload and surfaces meta.request_id', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { foo: 'bar' }, meta: { request_id: 'req_1' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      // res.data is the PAYLOAD, never the whole envelope (no double-unwrap).
      const res = await apiClient.get<{ foo: string }>('/test');
      expect(res.data).toEqual({ foo: 'bar' });
      expect(res.meta?.request_id).toBe('req_1');
    });

    it('surfaces meta.pagination on list responses', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 1 }, { id: 2 }],
            meta: {
              request_id: 'req_2',
              pagination: {
                per_page: 2,
                next: 'cur_2',
                has_more: true,
                estimated_total: 9,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const res = await apiClient.get<Array<{ id: number }>>('/things');
      expect(res.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(res.meta?.pagination).toEqual({
        per_page: 2,
        next: 'cur_2',
        has_more: true,
        estimated_total: 9,
      });
    });

    it('passes a non-enveloped body through unchanged (defensive)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ foo: 'bar' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const res = await apiClient.get<{ foo: string }>('/test');
      expect(res.data).toEqual({ foo: 'bar' });
      expect(res.meta).toBeUndefined();
    });
  });

  describe('request headers', () => {
    it('adds Authorization when token is set', async () => {
      setAccessToken(VALID_TOKEN);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await apiClient.get('/test');

      const call = fetchMock.mock.calls[0];
      const init = call[1] as RequestInit;
      const headers = init.headers as Headers;
      expect(headers.get('Authorization')).toBe(`Bearer ${VALID_TOKEN}`);
    });

    it('NEVER attaches the bearer token to a foreign-origin absolute URL', async () => {
      // Token exfiltration guard: if any code path resolves an absolute URL to a
      // host that is not the API origin, the access token must not ride along.
      setAccessToken(VALID_TOKEN);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await apiClient.get('https://evil.example.com/steal');

      const call = fetchMock.mock.calls[0];
      const requestedUrl = call[0] as string;
      const headers = (call[1] as RequestInit).headers as Headers;
      // The absolute URL is used verbatim, but it carries NO Authorization.
      expect(requestedUrl).toBe('https://evil.example.com/steal');
      expect(headers.get('Authorization')).toBeNull();
    });

    it('adds X-Request-ID', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await apiClient.get('/test');

      const call = fetchMock.mock.calls[0];
      const init = call[1] as RequestInit;
      const headers = init.headers as Headers;
      expect(headers.get('X-Request-ID')).toBeDefined();
      expect(typeof headers.get('X-Request-ID')).toBe('string');
    });

    it('adds Content-Type and X-Requested-With', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await apiClient.get('/test');

      const call = fetchMock.mock.calls[0];
      const init = call[1] as RequestInit;
      const headers = init.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    });
  });

  describe('reactive auth layer', () => {
    it('401 → delegate to the shared refresh → replay succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(unauthorized()) // original request
        .mockResolvedValueOnce(ok()); // replay (refresh is the service's stub)

      const { data } = await apiClient.get<{ ok: boolean }>('/protected');
      expect(data).toEqual({ ok: true });
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      // fetch-client must NEVER call /auth/refresh itself — only via service.
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.filter((u) => u.includes('/auth/refresh'))).toHaveLength(0);
      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('a token still rejected after two refreshes means a dead session: forceLogout, no refresh loop', async () => {
      fetchMock
        .mockResolvedValueOnce(unauthorized()) // original request
        .mockResolvedValueOnce(unauthorized()) // first replay STILL 401
        .mockResolvedValueOnce(unauthorized()); // second replay STILL 401

      await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(HttpError);
      // Bounded: two refreshes for one request, never a loop.
      expect(refreshAccessToken).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(forceLogout).toHaveBeenCalledTimes(1);
    });

    /** A JWT-shaped access token told apart by its subject. */
    const tokenNamed = (name: string): string => makeJwt({ sub: name, exp: 9999999999 });

    /** The bearer token one fetch call carried. */
    const bearerOf = (call: unknown[]): string | null =>
      ((call[1] as RequestInit).headers as Headers).get('Authorization');

    // clinozy-be keeps ONE live access token per session: every refresh and every workspace
    // switch retires the token before it. A 401 is therefore about the token a request carried,
    // and that token may have been replaced while the request was in flight.
    it('a 401 for a token replaced mid-flight replays with the current token, without a refresh', async () => {
      setAccessToken(tokenNamed('token-first'));
      fetchMock
        .mockImplementationOnce(() => {
          setAccessToken(tokenNamed('token-switched')); // a workspace switch landed meanwhile
          return Promise.resolve(unauthorized());
        })
        .mockResolvedValueOnce(ok());

      const { data } = await apiClient.get<{ ok: boolean }>('/protected');

      expect(data).toEqual({ ok: true });
      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(bearerOf(fetchMock.mock.calls[1] as unknown[])).toBe(
        `Bearer ${tokenNamed('token-switched')}`,
      );
      expect(forceLogout).not.toHaveBeenCalled();
    });

    describe('a request never goes out again with another organization’s token (E-1)', () => {
      /** A token scoped to one organization (its `org` claim), told apart by its subject. */
      const tokenFor = (organization: string, name = organization): string =>
        makeJwt({ sub: name, org: organization, exp: 9999999999 });

      it('a 401 for a token a switch to another clinic retired is not replayed', async () => {
        setAccessToken(tokenFor('org_clinicaaaaaaaaaaaaaaaa'));
        fetchMock.mockImplementationOnce(() => {
          // The switch to clinic B landed while this clinic-A read was out.
          setAccessToken(tokenFor('org_clinicbbbbbbbbbbbbbbbb'));
          return Promise.resolve(unauthorized());
        });

        const failure = await apiClient.get('/app/patients').catch((error) => error);

        // Replayed, clinic B's patients would have been cached under clinic A's key.
        expect(isUnauthorized(failure)).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(refreshAccessToken).not.toHaveBeenCalled();
        expect(forceLogout).not.toHaveBeenCalled();
      });

      it('a write is not replayed into the clinic switched to', async () => {
        setAccessToken(tokenFor('org_clinicaaaaaaaaaaaaaaaa'));
        fetchMock.mockImplementationOnce(() => {
          setAccessToken(tokenFor('org_clinicbbbbbbbbbbbbbbbb'));
          return Promise.resolve(unauthorized());
        });

        await expect(apiClient.post('/app/patients', { name: 'Ada' })).rejects.toSatisfy(
          isUnauthorized,
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it('a write the switch overtook says it was not saved, never that the session expired', async () => {
        setAccessToken(tokenFor('org_clinicaaaaaaaaaaaaaaaa'));
        fetchMock.mockImplementationOnce(() => {
          setAccessToken(tokenFor('org_clinicbbbbbbbbbbbbbbbb'));
          return Promise.resolve(unauthorized());
        });

        const failure = await apiClient
          .patch('/app/patients/pat_1', { name: 'Ada' })
          .catch((error: unknown) => error);

        expect((failure as HttpError).data).toEqual({
          error: { reason: 'WORKSPACE_SWITCHED' },
        });
        expect(mapApiError(failure)).toBe(
          'This change was not saved because you switched clinic.',
        );
      });

      it('a retry after a 5xx is not sent with the clinic switched to', async () => {
        vi.useFakeTimers();
        try {
          setAccessToken(tokenFor('org_clinicaaaaaaaaaaaaaaaa'));
          fetchMock.mockImplementationOnce(() => {
            setAccessToken(tokenFor('org_clinicbbbbbbbbbbbbbbbb'));
            return Promise.resolve(new Response('oops', { status: 503 }));
          });

          const outcome = apiClient.get('/app/patients').catch((error) => error);
          await vi.runAllTimersAsync();

          expect(isUnauthorized(await outcome)).toBe(true);
          expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
          vi.useRealTimers();
        }
      });

      it('a token rotated within the same clinic is still replayed', async () => {
        setAccessToken(tokenFor('org_clinicaaaaaaaaaaaaaaaa', 'first'));
        fetchMock
          .mockImplementationOnce(() => {
            setAccessToken(tokenFor('org_clinicaaaaaaaaaaaaaaaa', 'rotated'));
            return Promise.resolve(unauthorized());
          })
          .mockResolvedValueOnce(ok());

        const { data } = await apiClient.get<{ ok: boolean }>('/app/patients');

        expect(data).toEqual({ ok: true });
        expect(bearerOf(fetchMock.mock.calls[1] as unknown[])).toBe(
          `Bearer ${tokenFor('org_clinicaaaaaaaaaaaaaaaa', 'rotated')}`,
        );
      });
    });

    it('a replay retired by another rotation replays again instead of signing out', async () => {
      setAccessToken(tokenNamed('token-first'));
      vi.mocked(refreshAccessToken).mockImplementationOnce(async () => {
        setAccessToken(tokenNamed('token-refreshed'));
      });
      fetchMock
        .mockResolvedValueOnce(unauthorized()) // original request
        .mockImplementationOnce(() => {
          setAccessToken(tokenNamed('token-switched')); // a switch retired the refreshed token
          return Promise.resolve(unauthorized());
        })
        .mockResolvedValueOnce(ok());

      const { data } = await apiClient.get<{ ok: boolean }>('/protected');

      expect(data).toEqual({ ok: true });
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(bearerOf(fetchMock.mock.calls[2] as unknown[])).toBe(
        `Bearer ${tokenNamed('token-switched')}`,
      );
      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('a replay rejected with its token unchanged refreshes once more before giving up', async () => {
      setAccessToken(tokenNamed('token-first'));
      vi.mocked(refreshAccessToken)
        .mockImplementationOnce(async () => setAccessToken(tokenNamed('token-refreshed')))
        .mockImplementationOnce(async () =>
          setAccessToken(tokenNamed('token-refreshed-again')),
        );
      fetchMock
        .mockResolvedValueOnce(unauthorized()) // original request
        .mockResolvedValueOnce(unauthorized()) // retired by another tab's refresh
        .mockResolvedValueOnce(ok());

      const { data } = await apiClient.get<{ ok: boolean }>('/protected');

      expect(data).toEqual({ ok: true });
      expect(refreshAccessToken).toHaveBeenCalledTimes(2);
      expect(bearerOf(fetchMock.mock.calls[2] as unknown[])).toBe(
        `Bearer ${tokenNamed('token-refreshed-again')}`,
      );
      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('a token that keeps rotating under a request is replayed a bounded number of times', async () => {
      let rotation = 0;
      setAccessToken(tokenNamed('token-0'));
      fetchMock.mockImplementation(() => {
        rotation += 1;
        setAccessToken(tokenNamed(`token-${rotation}`));
        return Promise.resolve(unauthorized());
      });

      await expect(apiClient.get('/protected')).rejects.toBeInstanceOf(HttpError);
      // Never an endless loop, whatever keeps rotating the token.
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(8);
    });

    it('every concurrent 401 awaits the shared single-flight (no direct refresh fetch)', async () => {
      const seen = new Set<string>();
      // First hit per endpoint 401s, the replay succeeds.
      fetchMock.mockImplementation((url: string) => {
        if (seen.has(String(url))) return Promise.resolve(ok());
        seen.add(String(url));
        return Promise.resolve(unauthorized());
      });

      await Promise.all([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);

      // One delegation per 401; collapsing them into ONE network call is
      // refreshAccessToken's own single-flight, proven in service.test.ts.
      expect(refreshAccessToken).toHaveBeenCalledTimes(3);
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.filter((u) => u.includes('/auth/refresh'))).toHaveLength(0);
      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('a refused refresh hands the refusal to the session end (E-2)', async () => {
      const refusal = new Error('session revoked');
      vi.mocked(refreshAccessToken).mockRejectedValueOnce(refusal);
      fetchMock.mockResolvedValueOnce(unauthorized()); // original request

      // The refresh error surfaces to the caller after the session has ended; WHICH end — a
      // deliberate idle or age end, or a dead session — is service.ts's (service.test.ts).
      await expect(apiClient.get('/protected')).rejects.toThrow('session revoked');
      expect(endRefusedSession).toHaveBeenCalledExactlyOnceWith(refusal);
      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('a refresh that got no answer keeps the session and fails the request as unreachable', async () => {
      vi.mocked(refreshAccessToken).mockRejectedValueOnce(
        new Error('Refresh failed (503)'),
      );
      vi.mocked(isRefreshUnanswered).mockReturnValueOnce(true);
      fetchMock.mockResolvedValueOnce(unauthorized()); // original request

      const error = await apiClient.get('/protected').catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(0);
      // A slow or failing network says nothing about the session: nobody is signed out.
      expect(forceLogout).not.toHaveBeenCalled();
    });
  });

  describe('a caller signal (G-4)', () => {
    /** A fetch that answers only when its signal aborts — rejecting with the signal's reason. */
    const hangUntilAborted = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });

    it('cancels the request in flight: it rejects with the signal’s reason, never retried', async () => {
      fetchMock.mockImplementation(hangUntilAborted);
      const controller = new AbortController();

      const outcome = apiClient
        .get('/app/patients', { signal: controller.signal })
        .catch((error: unknown) => error);
      controller.abort();

      const failure = await outcome;
      expect(failure).toMatchObject({ name: 'AbortError' });
      expect(failure).not.toBeInstanceOf(HttpError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('never sends a request whose signal has already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(
        apiClient.post('/app/patients', { name: 'Ada' }, { signal: controller.signal }),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects with an error whatever the abort reason — a string one reads as an AbortError', async () => {
      const controller = new AbortController();
      controller.abort('left the page');
      const failure = await apiClient
        .get('/app/patients', { signal: controller.signal })
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(DOMException);
      expect(failure).toMatchObject({ name: 'AbortError' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('stops a retry’s wait at once, and sends nothing after it', async () => {
      vi.useFakeTimers();
      try {
        fetchMock.mockResolvedValue(new Response('oops', { status: 503 }));
        const controller = new AbortController();
        const outcome = apiClient
          .get('/app/patients', { signal: controller.signal })
          .catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(10);
        controller.abort();
        await vi.runAllTimersAsync();

        expect(await outcome).toMatchObject({ name: 'AbortError' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('still times out on its own, and leaves no listener on the caller’s signal', async () => {
      vi.useFakeTimers();
      try {
        fetchMock.mockImplementation(hangUntilAborted);
        const controller = new AbortController();
        const listen = vi.spyOn(controller.signal, 'addEventListener');
        const unlisten = vi.spyOn(controller.signal, 'removeEventListener');
        const outcome = apiClient
          .get('/app/patients', { signal: controller.signal })
          .catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(HTTP.TIMEOUT);

        const failure = await outcome;
        expect(failure).toBeInstanceOf(HttpError);
        expect((failure as HttpError).status).toBe(0);
        expect(unlisten).toHaveBeenCalledTimes(listen.mock.calls.length);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Accept-Language', () => {
    it("carries the app's language, so the server words its messages in it", async () => {
      const i18n = (await import('@/lib/i18n/i18n.ts')).default;
      const before = i18n.language;
      await i18n.changeLanguage('es');
      fetchMock.mockImplementation(() => Promise.resolve(ok()));

      await apiClient.get('/things');

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
      expect(headers.get('Accept-Language')).toBe('es');
      await i18n.changeLanguage(before);
    });
  });

  describe('X-Idempotency-Key', () => {
    const ok = () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    it('writes carry an auto-generated key; reads do not', async () => {
      // Fresh Response per call — a Response body can only be consumed once.
      fetchMock.mockImplementation(() => Promise.resolve(ok()));

      await apiClient.post('/things', { a: 1 });
      await apiClient.get('/things');

      const postHeaders = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
      const getHeaders = (fetchMock.mock.calls[1][1] as RequestInit).headers as Headers;
      expect(postHeaders.get('X-Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
      expect(getHeaders.get('X-Idempotency-Key')).toBeNull();
    });

    it('the SAME key survives the 401 refresh replay (server can de-dupe)', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(ok()); // replay (refresh is the service's stub)

      await apiClient.post('/things', { a: 1 });

      const first = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
      const replay = (fetchMock.mock.calls[1][1] as RequestInit).headers as Headers;
      expect(first.get('X-Idempotency-Key')).toBe(replay.get('X-Idempotency-Key'));
      expect(first.get('X-Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    });

    it("a caller's key (one per user action) is sent as given, on every write method", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(ok()));

      await apiClient.post('/things', { a: 1 }, { idempotencyKey: 'action-key-0001' });
      await apiClient.patch('/things/1', { a: 2 }, { idempotencyKey: 'action-key-0002' });
      await apiClient.put('/things/1', { a: 3 }, { idempotencyKey: 'action-key-0003' });
      await apiClient.delete('/things/1', { idempotencyKey: 'action-key-0004' });

      const keys = fetchMock.mock.calls.map((call) =>
        ((call[1] as RequestInit).headers as Headers).get('X-Idempotency-Key'),
      );
      expect(keys).toEqual([
        'action-key-0001',
        'action-key-0002',
        'action-key-0003',
        'action-key-0004',
      ]);
    });

    it("a caller's key survives the 401 refresh replay", async () => {
      fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());

      await apiClient.post('/things', { a: 1 }, { idempotencyKey: 'action-key-0005' });

      const keys = fetchMock.mock.calls.map((call) =>
        ((call[1] as RequestInit).headers as Headers).get('X-Idempotency-Key'),
      );
      expect(keys).toEqual(['action-key-0005', 'action-key-0005']);
    });

    it('a read ignores a key it is given', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(ok()));

      await apiClient.get('/things', { idempotencyKey: 'action-key-0006' });

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
      expect(headers.get('X-Idempotency-Key')).toBeNull();
    });
  });

  describe('write methods (PUT / DELETE)', () => {
    it('DELETE and PUT both carry an auto-generated X-Idempotency-Key', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(ok()));

      await apiClient.delete('/things/1');
      await apiClient.put('/things/1', { a: 1 });

      const deleteHeaders = (fetchMock.mock.calls[0][1] as RequestInit)
        .headers as Headers;
      const putHeaders = (fetchMock.mock.calls[1][1] as RequestInit).headers as Headers;
      expect(deleteHeaders.get('X-Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
      expect(putHeaders.get('X-Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    });

    it('DELETE 401 → shared refresh → replay succeeds', async () => {
      fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());

      const { data } = await apiClient.delete<{ ok: boolean }>('/things/1');

      expect(data).toEqual({ ok: true });
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('PUT keeps the SAME X-Idempotency-Key across the 401 replay', async () => {
      fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());

      await apiClient.put('/things/1', { a: 1 });

      const first = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
      const replay = (fetchMock.mock.calls[1][1] as RequestInit).headers as Headers;
      expect(first.get('X-Idempotency-Key')).toBe(replay.get('X-Idempotency-Key'));
      expect(first.get('X-Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    });
  });

  describe('write hold', () => {
    it('keeps a held write here: a 403 with the hold reason, nothing sent', async () => {
      const stop = setWriteHold(({ path }) => (path.startsWith('/app/') ? 'held' : null));
      try {
        const refusal = await apiClient
          .post('/app/leads', { a: 1 })
          .catch((error) => error);

        expect(refusal).toBeInstanceOf(HttpError);
        expect(refusal).toMatchObject({
          status: 403,
          method: 'POST',
          data: { error: { reason: 'held' } },
        });
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        stop();
      }
    });

    it('sends what the hold lets through, and never asks it about a read', async () => {
      const hold = vi.fn(({ path }: { path: string }) =>
        path.startsWith('/app/') ? 'held' : null,
      );
      const stop = setWriteHold(hold);
      fetchMock.mockImplementation(() => Promise.resolve(ok()));
      try {
        await apiClient.get('/app/leads');
        await apiClient.patch('/users/me/settings', { a: 1 });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(hold).toHaveBeenCalledTimes(1);
        expect(hold).toHaveBeenCalledWith({
          method: 'PATCH',
          path: '/users/me/settings',
        });
      } finally {
        stop();
      }
    });

    it('sends every write again once the hold is cleared', async () => {
      setWriteHold(() => 'held')();
      fetchMock.mockImplementation(() => Promise.resolve(ok()));

      await apiClient.delete('/app/leads/lead_1');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('organization scoping', () => {
    it('never sends an X-Organization-ID header (org context lives in the URL path)', async () => {
      const { useOrganizationStore } =
        await import('@/shared/store/useOrganizationStore/index.ts');
      useOrganizationStore.getState().setOrganization('org_test1', 'test');
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await apiClient.get('/api/v1/tenancy/organizations/org_test1');

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
      expect(headers.get('X-Organization-ID')).toBeNull();
      useOrganizationStore.getState().clearOrganization();
    });
  });

  describe('retry budget & rate limiting (audit 3.1–3.3)', () => {
    const errJson = (status: number, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify({ message: 'x' }), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
      });

    it('429 with Retry-After retries once, then succeeds (3.1)', async () => {
      fetchMock
        .mockResolvedValueOnce(errJson(429, { 'Retry-After': '0' }))
        .mockResolvedValueOnce(ok());
      const { data } = await apiClient.get<{ ok: boolean }>('/x');
      expect(data).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('429 without Retry-After surfaces immediately — no auto-retry (3.1)', async () => {
      fetchMock.mockResolvedValueOnce(errJson(429));
      await expect(apiClient.get('/x')).rejects.toBeInstanceOf(HttpError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('429 with a Retry-After beyond the cap is not auto-retried (3.1)', async () => {
      fetchMock.mockResolvedValueOnce(errJson(429, { 'Retry-After': '60' }));
      await expect(apiClient.get('/x')).rejects.toBeInstanceOf(HttpError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('a 503 with Retry-After waits at least that long before retrying', async () => {
      vi.useFakeTimers();
      try {
        fetchMock
          .mockResolvedValueOnce(errJson(503, { 'Retry-After': '5' }))
          .mockResolvedValueOnce(ok());
        const request = apiClient.get<{ ok: boolean }>('/x');
        // The exponential backoff alone would retry after 1 s.
        await vi.advanceTimersByTimeAsync(4_999);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const { data } = await request;
        expect(data).toEqual({ ok: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it('a 5xx without Retry-After keeps the exponential backoff', async () => {
      vi.useFakeTimers();
      try {
        fetchMock.mockResolvedValueOnce(errJson(503)).mockResolvedValueOnce(ok());
        const request = apiClient.get<{ ok: boolean }>('/x');
        await vi.advanceTimersByTimeAsync(999);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const { data } = await request;
        expect(data).toEqual({ ok: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it('a 503 with a Retry-After beyond the cap is not auto-retried', async () => {
      fetchMock.mockResolvedValueOnce(errJson(503, { 'Retry-After': '60' }));
      await expect(apiClient.get('/x')).rejects.toBeInstanceOf(HttpError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('a dropped connection on a GET is retried after the backoff, then succeeds', async () => {
      vi.useFakeTimers();
      try {
        fetchMock
          .mockRejectedValueOnce(new TypeError('network'))
          .mockResolvedValueOnce(ok());
        const request = apiClient.get<{ ok: boolean }>('/x');
        await vi.advanceTimersByTimeAsync(999);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const { data } = await request;
        expect(data).toEqual({ ok: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it('a dropped connection on a POST is not retried, and surfaces as status 0', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('network'));
      const failure = await apiClient.post('/x', {}).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(HttpError);
      expect((failure as HttpError).status).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('a timeout (AbortError) is not retried (3.3)', async () => {
      const abort = Object.assign(new Error('timeout'), { name: 'AbortError' });
      fetchMock.mockRejectedValueOnce(abort);
      await expect(apiClient.get('/slow')).rejects.toBeInstanceOf(HttpError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('caps total attempts across mixed connection + 5xx failures (3.2)', async () => {
      vi.useFakeTimers();
      try {
        fetchMock
          .mockRejectedValueOnce(new TypeError('network'))
          .mockResolvedValueOnce(errJson(503))
          .mockRejectedValueOnce(new TypeError('network'))
          .mockImplementation(() => Promise.resolve(errJson(503)));
        const assertion = expect(apiClient.get('/x')).rejects.toBeInstanceOf(HttpError);
        await vi.runAllTimersAsync();
        await assertion;
        // Single budget: connection + status retries never exceed MAX_RETRIES + 1.
        expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(HTTP.MAX_RETRIES + 1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('isUnauthorized', () => {
    it('returns true for HttpError with status 401', () => {
      const error = new HttpError('Unauthorized', 401, '/test', 'GET');
      expect(isUnauthorized(error)).toBe(true);
    });

    it('returns false for HttpError with status 403', () => {
      const error = new HttpError('Forbidden', 403, '/test', 'GET');
      expect(isUnauthorized(error)).toBe(false);
    });

    it('returns false for non-HttpError', () => {
      expect(isUnauthorized(new Error('random'))).toBe(false);
      expect(isUnauthorized('string')).toBe(false);
      expect(isUnauthorized(null)).toBe(false);
    });
  });
});
