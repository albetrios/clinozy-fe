# Frontend security model

What the frontend defends against, how, and which risks are **deliberately
accepted** (so they aren't re-litigated in every review). The backend re-checks
everything — frontend controls are defense-in-depth and UX, never the only gate.

## Threats covered

| Threat                           | Control                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Where                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token theft via XSS              | Access token in a **module-closure in memory** — never `localStorage`/`sessionStorage`; refresh token is an HttpOnly cookie the JS never reads                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [`shared/auth/token.ts`](../../src/shared/auth/token.ts); test: `tests/security/token-storage.security.test.ts`                                                                                                                                                                                            |
| Script injection (XSS)           | CSP `script-src 'self'` — no `unsafe-inline`/`unsafe-eval`; Zod runs jitless (`src/lib/zod-jitless.ts`, first in the `zod` chunk), so no schema probes `new Function` and the CSP never has an eval to block; the only `dangerouslySetInnerHTML` is `QrCode`'s SVG, generated in the browser by `qrcode` from the MFA enrolment's otpauth URI (never user input); `assetsInlineLimit: 0` (no inlined data URIs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | header CSP + `index.html` meta; test: `tests/security/static-security-config.security.test.ts`; `src/lib/zod-jitless.test.ts`                                                                                                                                                                              |
| CSRF on auth endpoints           | `X-Requested-With: XMLHttpRequest` custom header (can't be set cross-origin without a CORS preflight the backend rejects) + `credentials: 'include'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [`shared/auth/service.ts`](../../src/shared/auth/service.ts), [`shared/api/auth-api.ts`](../../src/shared/api/auth-api.ts)                                                                                                                                                                                 |
| Clickjacking                     | `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'` (header-delivered — meta CSP ignores it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [`public/_headers`](../../public/_headers)                                                                                                                                                                                                                                                                 |
| Open redirect (post-login)       | `isSafeRedirectPath` rejects absolute URLs, protocol-relative `//`, scheme smuggling, backslash normalization, and embedded control/whitespace; `isSafeExternalHttpsUrl` gates the OAuth provider URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`shared/auth/redirect-safety.ts`](../../src/shared/auth/redirect-safety.ts); test: `tests/security/redirect-safety.security.test.ts`                                                                                                                                                                      |
| Cross-tenant data bleed          | Every org-scoped TanStack Query key embeds the active org id, so two tenants never share a cache entry; the active-org switch re-mints the token under a **switch-generation guard** (a superseded switch can't clobber the latest); notifications + billing are org-keyed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [`shared/api/organization-query-keys.ts`](../../src/shared/api/organization-query-keys.ts), [`shared/tenancy/switch.ts`](../../src/shared/tenancy/switch.ts); test: `tests/security/cross-tenant-query-keys.security.test.ts`                                                                              |
| Bearer-token exfiltration        | `Authorization` is attached **only** when the request URL resolves to the configured API origin — a stray or foreign absolute URL (userinfo spoof, lookalike host, protocol-relative) never receives the token                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [`core/http/fetch-client.ts`](../../src/core/http/fetch-client.ts) (`isApiOriginUrl`); test: `tests/security/token-egress.security.test.ts`                                                                                                                                                                |
| Stolen-session reuse across tabs | Cross-tab logout broadcast: a dead session (admin-suspend, logout-all, expiry) in one tab clears the in-memory token in **every** open tab                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [`shared/auth/auth-channel.ts`](../../src/shared/auth/auth-channel.ts)                                                                                                                                                                                                                                     |
| Replay / double-submit           | 401 → replay with the current token when it was replaced in flight (clinozy-be keeps one live token per session); else single-flight refresh + replay, **at most twice** per request — a refused refresh or a token still rejected after two refreshes = dead session → logout, never a loop; writes carry an `X-Idempotency-Key` minted once per logical request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | [`core/http/fetch-client.ts`](../../src/core/http/fetch-client.ts)                                                                                                                                                                                                                                         |
| Cross-tenant token (two tabs)    | A refresh answering for another organization than the tab's `me/context` (another tab switched the session's one token) is switched back inside the refresh lock before any request carries it; a refused switch-back hands the tab to `/`, an unanswered one fails the request as unreachable — never another clinic's records under this tab's screen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `src/shared/auth/service.ts` (`onThisTabsOrganization`), `tests/e2e/org-switching.e2e.test.ts`                                                                                                                                                                                                             |
| Refresh-rotation race            | `refreshAccessToken()` is the **only** `/auth/refresh` caller: a module single-flight collapses concurrent callers (proactive timer + 401s) and a `navigator.locks` Web Lock (`clinozy-auth:refresh`) serializes tabs — parallel refreshes would trip the backend's rotation reuse-detection and kill the session; a refresh with no usable answer (timeout, offline, 429, 5xx) is retried once inside the backend's 10 s reuse grace and never signs anyone out by itself — only a refusal does                                                                                                                                                                                                                                                                                                                                                                                                      | [`shared/auth/service.ts`](../../src/shared/auth/service.ts)                                                                                                                                                                                                                                               |
| Reset/verify token exposure      | `useConsumedSearchToken` reads `?token=` once and scrubs it from the address bar (`history.replaceState`) — it never lingers in history or copy-pasted links; telemetry scrubs `token` **and** Stripe `*_client_secret` params from every outgoing Sentry/PostHog event for the window before that effect runs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [`shared/hooks/useConsumedSearchToken/`](../../src/shared/hooks/useConsumedSearchToken/useConsumedSearchToken.ts), [`lib/telemetry-scrub.ts`](../../src/lib/telemetry-scrub.ts)                                                                                                                            |
| Weak / breached credentials      | Register + reset password gate on a **Have I Been Pwned** k-anonymity check (only a SHA-1 prefix leaves the browser; confirmed breach blocks submit) and show a 0–4 strength meter that penalizes common, identity-derived, and trivially-patterned passwords. Advisory to the user, hard gate on a confirmed breach; the backend enforces the real policy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [`lib/password-breach.ts`](../../src/lib/password-breach.ts), [`lib/password-strength.ts`](../../src/lib/password-strength.ts), [`shared/components/PasswordStrengthMeter/`](../../src/shared/components/PasswordStrengthMeter/PasswordStrengthMeter.tsx)                                                  |
| Stale long-lived session         | Absolute session-lifetime cap (`SESSION.MAX_AGE_MS`, 12 h) on top of the idle timeout: a session kept warm by the proactive refresh is signed out — **revoked server-side via `logout()`**, not just cleared locally — once it exceeds the cap, measured from **interactive** auth (not boot refreshes). UX/defense-in-depth — the backend's refresh-session age is the source of truth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [`shared/auth/session-lifetime.ts`](../../src/shared/auth/session-lifetime.ts)                                                                                                                                                                                                                             |
| Unattended session (idle)        | 5 min idle → warning dialog, +90 s → sign-out, and both exits **end the session server-side** (`logout()` → `POST /auth/logout`), not just the tab: `forceLogout()` alone leaves the HttpOnly refresh cookie valid and `/login` silently restores the session. Idle time is **wall-clock** (a laptop waking past the deadline is signed out at once, not offered a fresh grace period), activity is shared across tabs so a background tab cannot sign out the active one, and a revoke that could not reach the server (offline on wake) is finished at the next boot via a `clinozy:logout-pending` flag — a boolean, never a token — behind the login screen, which does not wait for it; a sign-in request waits for it instead, so the old session's cookie cannot land over the new one. A deliberate end also suppresses auto-Google sign-in so `/login` cannot sign the user straight back in | [`shared/auth/idle-timeout.ts`](../../src/shared/auth/idle-timeout.ts), [`shared/auth/service.ts`](../../src/shared/auth/service.ts), `shared/components/SessionTimeoutDialog`; tests: `service.pending-revoke.test.ts`, `SessionTimeoutDialog.sign-out.test.tsx`, `tests/e2e/session-timeout.e2e.test.ts` |
| Leaked internals in error UI     | `sanitizeServerMessage` drops messages that look like SQL, stack traces, or file paths; Sentry receives only `user.id`, never PII                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | [`shared/errors/errorHandler.ts`](../../src/shared/errors/errorHandler.ts)                                                                                                                                                                                                                                 |
| Stale PII / grants after logout  | `clearLocalAuthState()` wipes the TanStack Query cache (`queryClient.clear()`) **and** the active-org context + RBAC `permissions` (`clearOrganization()`) on every logout path — as the page goes (`pagehide`, so a page the back/forward cache keeps holds none either, and one restored from there loads again), or at once where no page load follows (a sibling tab already on `/login`); the token, the session hint and saved onboarding progress go at once. The full `/login` load then discards whatever modules hold in memory                                                                                                                                                                                                                                                                                                                                                             | `shared/auth/service.ts`; test: `shared/auth/service.test.ts`                                                                                                                                                                                                                                              |
| Reverse tabnabbing               | No `target="_blank"` without `rel`; no `window.opener` exposure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | (grep-verified absent)                                                                                                                                                                                                                                                                                     |
| Supply chain                     | `pnpm deps:audit` (bulk advisory; all + prod), dependency-review, SBOM, gitleaks, semgrep, CodeQL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | CI lanes — see [tools-and-usage.md](tools-and-usage.md)                                                                                                                                                                                                                                                    |

### Third-party telemetry (token / PII containment)

Sentry and PostHog run in the same JS context as the in-memory token, so their
capture settings are part of the threat model — verified:

- **Sentry replay** — **consent-gated** with profiling (added only while the cookie
  card's Analytics category is on, stopped at once on a withdrawal; profiling follows the
  answer at page load). `maskAllText: true` + `blockAllMedia: true`; inputs are
  masked by default and **network request headers/bodies are not captured**
  (no `networkDetailAllowUrls`), so the `Authorization: Bearer` header never
  reaches Sentry. `beforeSend` filters `ui.input` breadcrumbs and — together
  with `beforeSendTransaction` — scrubs `token` and Stripe `*_client_secret`
  query params from event and breadcrumb URLs (`lib/telemetry-scrub.ts`); only
  `user.id` is identified.
  ([`app/observability/sentry.ts`](../../src/app/observability/sentry.ts))
- **PostHog** — **consent-gated**: it sets cookies and captures pageviews, so it
  does not initialize until the user accepts the cookie banner
  (`shared/components/ConsentBanner`, `shared/store/useConsentStore`; `main.tsx`
  reacts to the decision and `initPostHog` refuses without consent). Beyond that:
  `autocapture: false` and `disable_session_recording: true` keep passive
  DOM/network capture off in code; only explicitly-coded events are sent;
  `before_send` scrubs `token` and Stripe `*_client_secret` params from
  `$current_url`-style properties; and
  `posthog.reset()` runs when the session ends so successive users on a shared
  device never chain into one anonymous profile. Accepting the banner emits a
  single `analytics_consent_decision` event (`shared/analytics/record-consent-decision.ts`).
  ([`app/analytics/posthog.ts`](../../src/app/analytics/posthog.ts)) Sentry's error
  reports are **not** gated — no tracking cookies, legitimate interest.
- **Consent is the browser's, as on claude.com** (iteration
  `change-cookie-consent-2026-10-13-fmal`) — one first-party cookie,
  `clinozy-consent-preferences` (`{analytics, version, decidedAt}`, one year, `Path=/`,
  `SameSite=Lax`, `Secure` on https), holds the answer per category: Necessary is always on,
  Analytics is the choice. A missing, unreadable or older-policy (`CONSENT_POLICY_VERSION`)
  cookie counts as not answered and the card asks again. **Signing out never forgets it and
  signing in never replaces it**, so a shared clinic computer is not asked at every sign-out;
  PostHog's identity is still reset at sign-out (above). Escape inside the card is Reject all;
  Global Privacy Control is Reject all and is never asked. Signed in, each new answer is also
  sent to the account as a **receipt** (`PATCH /users/me/settings` with the policy version;
  clinozy-be audits it as the proof of consent) — never read back. Refusing Analytics purges
  PostHog's `ph_*` identifiers. "Privacy choices" on the signed-out frame and Settings ›
  Account › Privacy change it. `index.html` does not preconnect to PostHog, so nothing reaches
  it before a grant.
  ([`shared/store/useConsentStore/useConsentStore.ts`](../../src/shared/store/useConsentStore/useConsentStore.ts)
  reads it on every first paint;
  [`shared/components/ConsentBanner/save-consent-preferences.ts`](../../src/shared/components/ConsentBanner/save-consent-preferences.ts)
  writes it, from the card and Settings only;
  [`shared/analytics/record-consent-decision.ts`](../../src/shared/analytics/record-consent-decision.ts)
  sends the event and the receipt)
- **Service worker** — precaches only static build assets + fonts; **no runtime
  caching of `/api`** or auth responses, so a shared device cannot serve one
  user's data to another from the SW cache. ([`src/sw.ts`](../../src/sw.ts))

### Content-Security-Policy delivery

The CSP ships **two ways**, both built from one source
([`lib/csp-api-origin.ts` → `buildContentSecurityPolicy`](../../src/lib/csp-api-origin.ts)):

- **Header** (`dist/_headers`, generated at build by `plugins/csp-api-origin.ts`)
  — authoritative: applies before the document parses and carries reporting
  directives. The committed `public/_headers` holds a minimal
  `frame-ancestors 'none'` line that the build upgrades to the full policy with
  the per-environment API origin injected into `connect-src`.
- **Meta** (`index.html`) — a parse-time fallback for hosts that drop the header.

Set `VITE_CSP_REPORT_URI` (e.g. a Sentry CSP ingest URL) to turn on
`report-uri`/`report-to` + a `Reporting-Endpoints` header, so production CSP
violations — including blocked XSS attempts — are collected instead of silent.

**Trusted Types (staged rollout).** The build also emits a
`Content-Security-Policy-Report-Only` header carrying
`require-trusted-types-for 'script'`
([`buildTrustedTypesReportOnlyPolicy`](../../src/lib/csp-api-origin.ts)). This is
a structural DOM-XSS defense — it flags any script sink (`innerHTML`, `eval`, …)
that receives a plain string instead of a Trusted Type — shipped **report-only**
because React 19 is Trusted-Types-aware but Sentry/PostHog may use sinks.
Report-only is header-only — `http-equiv` can't carry it — so there is no meta
fallback.

The header ships on **every** deploy, but `VITE_CSP_REPORT_URI` decides whether
anyone sees the result. Unset, the policy carries no `report-uri`/`report-to`:
each violation lands in that one visitor's DevTools console and is never
aggregated, so promoting `require-trusted-types-for 'script'` into the enforcing
policy — the goal of shipping it report-only — has no evidence to act on. Set
the collector before starting that clock; `pnpm validate:client-env` warns (does
not fail) on a deploy environment that leaves it unset. Steps:
[the Trusted Types runbook](../deployment/runbooks/csp-trusted-types-production.md).

## Accepted risks (intentional — do not "fix" without re-reading this)

1. **`style-src 'unsafe-inline'`.** Required by Tailwind v4's generated styles
   and Radix's inline positioning. Severity is low: with `script-src 'self'`
   locked, this permits CSS injection (UI redress, attribute-selector
   exfiltration) but **not** script execution. Removing it needs per-render
   nonces and fights the component stack. Accepted; revisit only if the styling
   approach changes.
2. **OAuth `state`/PKCE is not validated in the frontend.** By design the
   **backend is the OAuth broker**: it mints the `state` (bound to an
   `oauth_nonce` cookie) and the PKCE verifier when sign-in starts, and the
   provider sends the browser back to `/callback/<provider>?code=…&state=…`.
   `CallbackPage` ([`src/pages/callback/`](../../src/pages/callback/CALLBACK.OVERVIEW.md))
   relays them and checks only their shape — `state` is 64 lowercase hex
   characters (clinozy-be's own mint), `code` 1–2048 visible ASCII characters,
   the provider a lowercase slug; a value of any other shape counts as absent. It
   forwards `code` + `state` to clinozy-be's `GET /auth/oauth/:provider/callback`
   in an XHR that carries the `oauth_nonce` cookie, and the backend consumes the
   single-use state, checks the nonce binding and PKCE, exchanges the code, sets
   the HttpOnly refresh cookie on that response and returns the access token (or
   the MFA hand-off to `/mfa`). The frontend holds no secret to check a `state`
   against, so the CSRF protection for the flow is the backend's.

   Without `code` + `state` — a direct visit, a provider denial — the page asks
   `/auth/refresh` only when this browser holds the session hint
   (`hasSessionHint()`, the same check the boot makes before its silent
   refresh). With no hint there is no session to restore, so it fails straight
   to `/login?error=oauth_failed` without a request; the hint never authorizes —
   when it is present, the refresh still decides. (Confirm this contract holds if
   the flow changes.)

3. **`config.js` runtime config injection.** `<script src="/config.js">` loads
   the API base URL written by the deploy. It is same-origin (covered by
   `script-src 'self'`), served over HTTPS with immutable caching. The residual
   risk is a deploy-pipeline / host compromise — infrastructure trust, outside
   the frontend code's control.

   **Subresource Integrity (SRI) is deliberately not added in app code here.**
   `config.js` is generated at deploy time by the Docker entrypoint, so its hash
   is unknown at build — SRI on it belongs to that entrypoint: compute
   `sha384` of the generated file and inject `integrity="sha384-…"` into the
   `index.html` script tag it writes (the same step that writes `config.js`).
   For the in-repo static scripts (`theme-init.js`), build-time SRI was
   evaluated and **declined**: they are same-origin and already constrained by
   `script-src 'self'`, while `integrity` would break the app if any host-side
   byte transform (minify, re-encode) touched them — net-negative for a
   negligible gain. Revisit if these scripts ever move to a third-party origin.

4. **Login is not synced across tabs** (only logout is). A fresh tab obtains its
   own token via the boot silent-refresh; tokens never leave their tab's memory.
   Propagating login would tempt cross-tab token sharing for no security gain.
5. **Client-side RBAC is non-authoritative.** Route guards (`requirePermission`,
   the security gateway) and UI gating (`useCan`, `<Gate>`) read the in-memory
   role + active-org permission set. A tampered in-memory store can flip any of
   these **client-side**. This is accepted: it is UX/redirect logic only —
   **every** org-scoped action re-checks on the backend (via the signed `org`
   claim in the access token), and the route loader's fetch is the real
   authorization boundary (API 403/404 → Unauthorized/NotFound islands).
   Never let a destructive action rely on the client check alone.

   `hasPermission` in [`core/rbac/policies.ts`](../../src/core/rbac/policies.ts)
   previously short-circuited to `true` for `super_admin` ("platform god-mode").
   That is gone. `super_admin` is a **platform-admin role** — the admin console,
   `requireRole` on clinozy-be's `/users/*`, `/audit/logs` and `/mcp` — and clinozy-be
   grants it nothing inside an organization: `requireOrganizationPermission`
   resolves a strict role→membership join with no global-role branch, and the
   tenancy RLS policies never honour `app.global_admin`. The bypass therefore
   unlocked controls the API answered with 403, and each click wrote a
   permission-deny audit row. Being _more_ permissive than the boundary is a
   broken UI, not a breach — but it is still wrong, so the client now mirrors
   the server exactly. A super_admin needing access inside an organization gets
   it the normal way: a membership with a role.

6. **`connect-src` and `img-src` allow `https://*.amazonaws.com`.** Uploads go from the
   browser straight to S3 (a presigned POST or PUT — clinozy-be never sees the bytes), and
   stored files come back from it: a patient photo's `file_url`, a report file, the signed
   avatar and organization logo. The bucket and region differ per deployment, so the allowance
   is AWS's host suffix rather than one bucket. Without it every upload was refused by
   `connect-src` and every stored image by `img-src` (found in the D86 live check). The
   residual risk is a script that already runs here sending data to some other AWS-hosted
   endpoint — `script-src 'self'` is what keeps such a script out; no script, frame or
   default source is widened. A report file opens in its own tab, outside this policy. Narrow
   it to the bucket's host if one deployment's storage ever needs it.

## Backend's half (confirm, don't implement here)

- The refresh cookie must be `SameSite=Lax` (or stricter) and the backend must
  reject auth requests missing `X-Requested-With` — together with the frontend's
  custom header, that closes CSRF on `/auth/refresh`.
- Rate-limiting / brute-force protection on `/auth/login` (the frontend adds a
  client-side cooldown for UX, not as the control).
- Per-request authorization: every frontend guard is UX; the backend re-checks
  membership, status, and permission on every org-scoped endpoint.
