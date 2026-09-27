/**
 * Runtime config placeholder — overwritten at deploy (Docker entrypoint / Netlify).
 *
 * Contract (operator):
 *   - Keys match env var names WITHOUT the `VITE_` prefix (e.g. AUTH_OAUTH_GOOGLE).
 *   - Values override bundled `import.meta.env` at client boot (see env.config.ts).
 *   - Auth surface (OAuth buttons, email OTP, passkey) is env-only — never fetch
 *     provider lists from clinozy-be.
 *   - Session/org context still comes from GET /auth/me/context after login.
 *
 * Deploy hardening: serve this file with Subresource Integrity when promoted to
 * production — see docs/deployment/runbooks/csp-trusted-types-production.md.
 */
window.__CONFIG__ = {};
