/**
 * Isolated module for access token storage.
 *
 * Token is held in a module-scoped closure — NEVER in localStorage or sessionStorage.
 * Both `core/http/fetch-client.ts` and `shared/auth/service.ts` import from here
 * to avoid circular deps:
 *
 *   core/http/fetch-client.ts  -->  shared/auth/token.ts
 *   shared/auth/service.ts     -->  shared/auth/token.ts
 *   (no cycle)
 */

let accessToken: string | null = null;

/** Minimal JWT structure check: three dot-separated base64url segments */
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string): void => {
  if (!token) {
    throw new Error('[Auth] Cannot set empty access token');
  }
  if (!JWT_RE.test(token)) {
    throw new Error('[Auth] Invalid token format — expected JWT');
  }
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

/**
 * Decode the JWT payload and extract the `exp` claim (seconds since epoch).
 * Returns `null` if the token is missing, malformed, or has no `exp`.
 */
export function getTokenExpiry(): number | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

/**
 * Check if the current token is expired or will expire within `bufferMs`.
 * Returns `true` if token should be refreshed proactively.
 */
export function isTokenExpiringSoon(bufferMs: number = 60_000): boolean {
  const exp = getTokenExpiry();
  if (exp === null) return true; // No token or no exp → treat as expired
  const expiresAt = exp * 1000; // convert to ms
  return Date.now() + bufferMs >= expiresAt;
}
