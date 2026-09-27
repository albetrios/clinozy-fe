# CSRF Mitigation Strategy

## Current Defenses

This application relies on **three layers** of CSRF protection:

### 1. SameSite Cookie (Backend)

The refresh token is an `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) cookie set by the backend. Browsers will not send this cookie on cross-origin requests initiated by external sites.

**Requirement:** The backend **must** set `SameSite=Strict` or `SameSite=Lax` on all authentication cookies. Verify this in the backend auth service configuration.

### 2. Custom Request Header

All API requests sent via `apiClient` (`src/core/http/fetch-client.ts`) include:

```text
X-Requested-With: XMLHttpRequest
```

Browsers enforce CORS preflight for requests with custom headers. A cross-origin attacker's form submission or image tag cannot include custom headers, so the backend can reject requests missing this header.

**Requirement:** The backend should reject state-changing requests (POST/PUT/PATCH/DELETE) that lack the `X-Requested-With` header.

### 3. Bearer Token in Authorization Header

The access token is stored in a JavaScript module closure (memory only) and sent as a `Bearer` token in the `Authorization` header. Cross-origin attackers cannot read or attach this header from their domain.

## Why No CSRF Tokens?

Traditional double-submit CSRF tokens add complexity with minimal benefit when:

- Authentication cookies use `SameSite=Strict` or `Lax` (blocks cross-origin cookie sending)
- All API calls include custom headers that trigger CORS preflight
- Access tokens are in memory, not cookies

If the backend ever moves to session-cookie-only auth (no Bearer token), CSRF tokens should be added.

## Verification Checklist

- [ ] Backend sets `SameSite=Strict` or `SameSite=Lax` on the refresh cookie
- [ ] Backend sets `HttpOnly` and `Secure` flags on the refresh cookie
- [ ] Backend rejects POST/PUT/PATCH/DELETE without `X-Requested-With` header
- [ ] Frontend sends `X-Requested-With: XMLHttpRequest` on all API requests (confirmed in `fetch-client.ts`)
- [ ] Access token is stored in memory only, never in cookies (confirmed in `token.ts`)
