import {
  clearAccessToken,
  getAccessToken,
  getTokenExpiry,
  isTokenExpiringSoon,
  setAccessToken,
} from './token.ts';

/** Helper to create a minimal JWT with a given payload (base64url encoded) */
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/={1,2}$/, '');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  return `${header}.${body}.dGVzdHNpZw`;
}

describe('token', () => {
  afterEach(() => {
    clearAccessToken();
  });

  // ── Basic get/set/clear ──

  it('getAccessToken returns null initially', () => {
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('setAccessToken stores the token', () => {
    const jwt = makeJwt({ sub: 'user1' });
    setAccessToken(jwt);
    expect(getAccessToken()).toBe(jwt);
  });

  it('clearAccessToken clears it', () => {
    setAccessToken(makeJwt({ sub: 'user1' }));
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('setAccessToken throws for empty token', () => {
    expect(() => setAccessToken('')).toThrow('[Auth] Cannot set empty access token');
  });

  // ── JWT format validation ──

  it('setAccessToken rejects non-JWT strings', () => {
    expect(() => setAccessToken('not-a-jwt')).toThrow(
      '[Auth] Invalid token format — expected JWT',
    );
  });

  it('setAccessToken rejects strings with wrong segment count', () => {
    expect(() => setAccessToken('a.b')).toThrow('Invalid token format');
  });

  it('setAccessToken accepts valid JWT format', () => {
    const jwt = makeJwt({ sub: 'user1', exp: 9999999999 });
    expect(() => setAccessToken(jwt)).not.toThrow();
    expect(getAccessToken()).toBe(jwt);
  });

  // ── Token expiry ──

  it('getTokenExpiry returns null when no token', () => {
    expect(getTokenExpiry()).toBeNull();
  });

  it('getTokenExpiry extracts exp claim from JWT', () => {
    const exp = 1700000000;
    setAccessToken(makeJwt({ sub: 'user1', exp }));
    expect(getTokenExpiry()).toBe(exp);
  });

  it('getTokenExpiry returns null when no exp claim', () => {
    setAccessToken(makeJwt({ sub: 'user1' }));
    expect(getTokenExpiry()).toBeNull();
  });

  it('getTokenExpiry returns null when no token set', () => {
    clearAccessToken();
    expect(getTokenExpiry()).toBeNull();
  });

  // ── isTokenExpiringSoon ──

  it('isTokenExpiringSoon returns true when no token', () => {
    expect(isTokenExpiringSoon()).toBe(true);
  });

  it('isTokenExpiringSoon returns false for far-future token', () => {
    setAccessToken(makeJwt({ sub: 'user1', exp: 9999999999 }));
    expect(isTokenExpiringSoon()).toBe(false);
  });

  it('isTokenExpiringSoon returns true for past token', () => {
    setAccessToken(makeJwt({ sub: 'user1', exp: 1000000000 }));
    expect(isTokenExpiringSoon()).toBe(true);
  });

  it('isTokenExpiringSoon respects custom buffer', () => {
    const exp = Math.floor(Date.now() / 1000) + 30; // expires in 30s
    setAccessToken(makeJwt({ sub: 'user1', exp }));
    // With 60s buffer → should be expiring soon
    expect(isTokenExpiringSoon(60_000)).toBe(true);
    // With 10s buffer → should NOT be expiring soon
    expect(isTokenExpiringSoon(10_000)).toBe(false);
  });
});
