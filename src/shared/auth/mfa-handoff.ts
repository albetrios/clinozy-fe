/**
 * In-memory hand-off of the short-lived MFA session token across the client-side
 * `/login` → `/mfa` navigation.
 *
 * The token is held in a **module closure** — never `sessionStorage` /
 * `localStorage` — so a sensitive credential is never written to disk as clear
 * text (CodeQL `js/clear-text-storage-of-sensitive-data`). This mirrors the
 * access-token storage rule in `token.ts` (tokens live in memory only).
 *
 * The `/login` → `/mfa` step is a SPA route change (`navigate({ to: '/mfa' })`),
 * so the value survives it. A full page reload intentionally drops it — the token
 * is single-use and short-lived, and `MfaForm` already handles the empty case by
 * showing "session expired".
 */
type MfaHandoff = { mfaSessionToken: string; redirect?: string };

let handoff: MfaHandoff | null = null;

/** Stash the short-lived MFA session token (+ optional post-MFA redirect). */
export function stashMfaHandoff(mfaSessionToken: string, redirect?: string): void {
  handoff = redirect ? { mfaSessionToken, redirect } : { mfaSessionToken };
}

/** Read the pending MFA hand-off; `mfaSessionToken` is `''` when none is stashed. */
export function readMfaHandoff(): MfaHandoff {
  return handoff ?? { mfaSessionToken: '' };
}

/** Drop the stashed hand-off (after a successful verify, or on teardown). */
export function clearMfaHandoff(): void {
  handoff = null;
}
