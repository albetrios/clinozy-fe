import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkPasswordBreached } from './password-breach.ts';

// SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
// → prefix 5BAA6, suffix 1E4C9B93F3F0682250B6CF8331B7EE68FD8
const PASSWORD_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

describe('checkPasswordBreached', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a breach + count when the suffix is present (k-anonymity)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(`${PASSWORD_SUFFIX}:42\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1`, {
        status: 200,
      }),
    );

    const result = await checkPasswordBreached('password');

    expect(result).toEqual({ breached: true, count: 42 });
    // Only the 5-char prefix is sent — never the password or full hash.
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.pwnedpasswords.com/range/5BAA6',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Add-Padding']).toBe('true');
  });

  it('reports no breach when the suffix is absent', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('0000000000000000000000000000000000A:9', { status: 200 }),
    );
    expect(await checkPasswordBreached('password')).toEqual({
      breached: false,
      count: 0,
    });
  });

  it('returns null (best-effort) on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 503 }));
    expect(await checkPasswordBreached('password')).toBeNull();
  });

  it('returns null when the network throws — never blocks the user', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await checkPasswordBreached('password')).toBeNull();
  });

  it('returns null for an empty password without hitting the network', async () => {
    expect(await checkPasswordBreached('')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
