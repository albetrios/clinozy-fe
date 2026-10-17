import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAccessToken, setAccessToken } from '@/shared/auth/token.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

// The REAL fetch client under the step-up helpers — only the auth service is
// stubbed (full factory, same import-cycle reason as fetch-client.test.ts), so
// these prove what the network and the session actually see (QA AUTH-01).
vi.mock('@/shared/auth/service.ts', () => ({
  forceLogout: vi.fn(),
  isRefreshUnanswered: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
import { forceLogout, refreshAccessToken } from '@/shared/auth/service.ts';

import {
  listAuthMethods,
  stepUpWithEmailCode,
  stepUpWithPassword,
  stepUpWithTotp,
} from './step-up-api.ts';

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/={1,2}$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.dGVzdHNpZw`;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const wrongCredential = () =>
  json(401, {
    error: { code: 'UNAUTHORIZED', detail: 'Invalid or expired verification code' },
  });

const HELPERS = [
  ['email code', () => stepUpWithEmailCode('XXXXXX')],
  ['password', () => stepUpWithPassword('wrong-password')],
  ['TOTP', () => stepUpWithTotp('000000')],
] as const;

describe('step-up helpers over the real fetch client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(makeJwt({ sub: 'user1', exp: 9999999999 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  it.each(HELPERS)(
    'a wrong %s is one 401 — no refresh, no replay, no sign-out',
    async (_factor, verify) => {
      fetchMock.mockResolvedValueOnce(wrongCredential());

      const error = await verify().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(forceLogout).not.toHaveBeenCalled();
    },
  );

  it('the next, correct code succeeds on the same session', async () => {
    fetchMock
      .mockResolvedValueOnce(wrongCredential())
      .mockResolvedValueOnce(json(200, { data: null }));

    await expect(stepUpWithEmailCode('XXXXXX')).rejects.toBeInstanceOf(HttpError);
    await expect(stepUpWithEmailCode('A1B2C3')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(forceLogout).not.toHaveBeenCalled();
  });

  it('an authenticated read still refreshes and replays on an expired-token 401', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue(undefined);
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED' } }))
      .mockResolvedValueOnce(json(200, { data: [] }));

    await expect(listAuthMethods()).resolves.toEqual([]);

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(forceLogout).not.toHaveBeenCalled();
  });
});
