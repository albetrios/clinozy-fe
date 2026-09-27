/**
 * Security invariant: the access token lives in a module closure only.
 * CLAUDE.md → Auth & Security: "Never store tokens in localStorage or
 * sessionStorage." A regression here turns an XSS bug into stolen sessions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAccessToken, getAccessToken, setAccessToken } from '@/shared/auth/token.ts';

function base64url(value: string): string {
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/={1,2}$/, '');
}

const FAKE_JWT = `${base64url('{"alg":"none"}')}.${base64url('{"sub":"user_1"}')}.signature`;

describe('access token storage (security)', () => {
  afterEach(() => {
    clearAccessToken();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('never writes the token to localStorage or sessionStorage', () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');

    setAccessToken(FAKE_JWT);

    expect(getAccessToken()).toBe(FAKE_JWT);
    expect(storageWrite).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });

  it('rejects an empty token', () => {
    expect(() => setAccessToken('')).toThrow('[Auth] Cannot set empty access token');
  });

  it('rejects non-JWT-shaped tokens (header.payload.signature required)', () => {
    for (const malformed of ['not-a-jwt', 'a.b', 'a b c.d.e', 'a.b.c.d']) {
      expect(() => setAccessToken(malformed), malformed).toThrow(
        '[Auth] Invalid token format — expected JWT',
      );
    }
  });

  it('clearAccessToken removes the token from memory', () => {
    setAccessToken(FAKE_JWT);
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});
