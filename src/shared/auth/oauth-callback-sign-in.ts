import { OAUTH_PROVIDER_SLUG_PATTERN } from '@/lib/routes/params.ts';
import {
  bootstrapWithSignIn,
  establishSession,
  isRevokePending,
} from '@/shared/auth/service.ts';

/**
 * `state` is clinozy-be's own mint — 32 random bytes hex-encoded by
 * `createOAuthState` — so anything but 64 lowercase hex chars is not ours.
 */
const OAUTH_STATE_PATTERN = /^[0-9a-f]{64}$/;

/** Provider authorization codes: visible ASCII, bounded to the callback DTO limit. */
const OAUTH_CODE_PATTERN = /^[!-~]{1,2048}$/;

/** The provider redirect's three inputs — each `null` unless it is well-formed. */
export interface OAuthCallbackParams {
  code: string | null;
  state: string | null;
  provider: string | null;
}

/**
 * Validate the three provider/user-supplied inputs of an OAuth redirect before any
 * of them selects a code path.
 *
 * @remarks
 * Read from the URL the provider redirected to (`window.location`), not router
 * state: these arrive on a full-page redirect, before any SPA navigation. The server
 * remains the real gate either way — single-use CSRF state, browser-nonce binding
 * and PKCE all verify before a session is minted.
 */
export function readOAuthCallbackParams(
  rawProvider: unknown,
  search: string = window.location.search,
): OAuthCallbackParams {
  const params = new URLSearchParams(search);
  const rawCode = params.get('code');
  const rawState = params.get('state');
  return {
    code: rawCode !== null && OAUTH_CODE_PATTERN.test(rawCode) ? rawCode : null,
    state: rawState !== null && OAUTH_STATE_PATTERN.test(rawState) ? rawState : null,
    provider:
      typeof rawProvider === 'string' && OAUTH_PROVIDER_SLUG_PATTERN.test(rawProvider)
        ? rawProvider
        : null,
  };
}

/**
 * Exchange a provider's `code` for this app's session: clinozy-be's callback route
 * consumes the state and sets the refresh cookie, then {@link establishSession}
 * stamps and hydrates it.
 *
 * @remarks
 * The auth API is imported on demand: at boot it is not in the entry chunk, and the
 * hand-off is the only boot that needs it. Rejects with whatever the exchange
 * throws — `MfaRequiredError` included, which the callback page turns into `/mfa`.
 */
export async function completeOAuthSignIn(
  provider: string,
  params: { code: string; state: string },
): Promise<void> {
  const { authApi } = await import('@/shared/api/auth-api.ts');
  const { accessToken } = await authApi.oauthCallback(provider, params);
  await establishSession(accessToken);
}

/** The `<provider>` segment of a `/callback/<provider>` path. */
function providerInPath(pathname: string): string | null {
  return /^\/callback\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;
}

/** The sign-in this load started at boot, until the callback page takes it. */
let bootSignIn: { provider: string; state: string; signIn: Promise<void> } | null = null;

/**
 * Start the OAuth hand-off's sign-in at boot, beside the app's own download.
 *
 * @remarks
 * - **Why:** the callback page used to exchange the code only once its chunk and its
 *   translations had loaded — measured on a cold load, the exchange left ~1.4s after
 *   navigation, and everything after it waited too. Started here it runs in parallel,
 *   so the hand-off takes the longer of the two instead of their sum.
 * - **Algorithm:** only on `/callback/<provider>` with a well-formed code, state and
 *   provider ({@link readOAuthCallbackParams}); hands the promise to the auth
 *   bootstrap ({@link bootstrapWithSignIn}) so no `/auth/refresh` races the new
 *   refresh cookie. The callback page takes it ({@link takeOAuthCallbackSignIn}) —
 *   the code is single-use, so it is never sent twice.
 * - **Failure modes:** none raised here; the rejection is the callback page's to
 *   handle (a provider error, MFA required, a spent code).
 * - **Notes:** a sign-out still waiting to reach the server goes first
 *   (`settlePendingRevoke`), so with one pending this leaves the exchange to the
 *   callback page, after the boot has finished that revoke.
 *
 * @returns whether a sign-in started.
 */
export function startOAuthCallbackSignIn(
  location: Pick<Location, 'pathname' | 'search'> = window.location,
): boolean {
  if (bootSignIn) return true;
  if (isRevokePending()) return false;
  const { code, state, provider } = readOAuthCallbackParams(
    providerInPath(location.pathname),
    location.search,
  );
  if (!(code && state && provider)) return false;
  const signIn = completeOAuthSignIn(provider, { code, state });
  // The callback page handles the outcome once it takes it; until then a rejection
  // is not an unhandled one.
  signIn.catch(() => undefined);
  bootSignIn = { provider, state, signIn };
  bootstrapWithSignIn(signIn);
  return true;
}

/**
 * The sign-in {@link startOAuthCallbackSignIn} started for exactly these inputs —
 * once; `null` when none did, and the callback page exchanges the code itself.
 */
export function takeOAuthCallbackSignIn(
  provider: string,
  state: string,
): Promise<void> | null {
  if (!(bootSignIn && bootSignIn.provider === provider && bootSignIn.state === state)) {
    return null;
  }
  const { signIn } = bootSignIn;
  bootSignIn = null;
  return signIn;
}
