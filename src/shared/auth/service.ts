import {
  API_BASE_PATH,
  API_ENDPOINTS,
  AUTH_ROUTES,
  HTTP,
} from '@/core/config/constants.ts';
import { platformConfig } from '@/core/config/env.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { APP_SPLASH_SKIP } from '@/lib/app-splash.ts';
import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { broadcastLogout } from '@/shared/auth/auth-channel.ts';
import { skipAutoGoogleSignIn } from '@/shared/auth/auto-google-sign-in.ts';
import {
  clearActivity,
  IDLE_LOGOUT_AFTER_MS,
  idleFor,
  markActivity,
} from '@/shared/auth/idle-timeout.ts';
import { clearReturnTo } from '@/shared/auth/redirect-safety.ts';
import { cancelTokenRefresh, scheduleTokenRefresh } from '@/shared/auth/refresh-timer.ts';
import {
  clearSessionStart,
  hasSessionHint,
  isSessionExpired,
  markSessionStart,
} from '@/shared/auth/session-lifetime.ts';
import {
  clearAccessToken,
  getAccessToken,
  organizationClaimOf,
  setAccessToken,
} from '@/shared/auth/token.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { type MeContext, meContextQueryKey } from '@/shared/tenancy/me-context.ts';
import {
  hydrateSessionContext,
  invalidateSessionContext,
} from '@/shared/tenancy/session-context.ts';

import type { AuthUser } from './types.ts';

async function authFetch(
  url: string,
  init: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = HTTP.TIMEOUT, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      ...rest,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(rest.headers as Record<string, string>),
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

let authGeneration = 0;
let refreshPromise: Promise<void> | null = null;
let tokenRefreshPromise: Promise<void> | null = null;

/** Drop whatever work in flight for the current session resolves to. */
function supersedeSessionWork(): number {
  authGeneration += 1;
  refreshPromise = null;
  tokenRefreshPromise = null;
  return authGeneration;
}

/** Logout and new login supersede all work from the previous session. */
function beginAuthGeneration(): number {
  invalidateSessionContext();
  return supersedeSessionWork();
}

/**
 * End the session in everything the screen does not show: the work in flight
 * for it, the token and its refresh timer, and what the next page load would
 * read from storage — the session hint and the onboarding wizard's progress.
 */
function endSessionOffScreen(): void {
  supersedeSessionWork();
  try {
    cancelTokenRefresh();
    clearAccessToken();
    clearSessionStart();
    clearActivity();
    // A deep link stashed for an OAuth round trip is this session's: the next
    // person to sign in on this tab must not be sent to it (F-9).
    clearReturnTo();
    // The wizard's saved progress holds PII (names, invite emails); the next
    // load must not find it. Its in-memory copy goes with the screen.
    useOnboardingStore.persist.clearStorage();
  } catch (cleanupError) {
    if (platformConfig.debugLogging) {
      console.error('[Auth] Cleanup failed during logout', cleanupError);
    }
  }
}

function clearLocalAuthState(): void {
  invalidateSessionContext();
  endSessionOffScreen();
  try {
    useAuthStore.getState().clearAuth();
    // Wipe the active-org context too — it holds the RBAC `permissions` that
    // `useCan` reads. A sign-out that stays on this page — cross-tab logout
    // while already on /login — would otherwise leave one user's grants in the
    // store for the next sign-in.
    useOrganizationStore.getState().clearOrganization();
    // Onboarding progress persists to localStorage (resumable wizard) and
    // holds PII (names, invite emails). Left behind, the NEXT user on this
    // browser would inherit the previous user's step + data — and the wizard
    // would submit the previous user's name onto their account.
    useOnboardingStore.getState().reset();
    queryClient.clear();
  } catch (cleanupError) {
    if (platformConfig.debugLogging) {
      console.error('[Auth] Cleanup failed during logout', cleanupError);
    }
  }
}

/**
 * Let the `/login` load a sign-out hands the tab to go straight to the login screen: the key
 * `public/splash-init.js` reads — once — before that load paints (`APP_SPLASH_SKIP`).
 */
function skipSplashOnNextLoad(): void {
  try {
    sessionStorage.setItem(APP_SPLASH_SKIP, '1');
  } catch {
    /* storage unavailable (private mode) — that load plays the splash */
  }
}

/** A page the back/forward cache kept after a sign-out loads again instead of showing. */
function reloadIfRestored(event: PageTransitionEvent): void {
  if (event.persisted) window.location.reload();
}

/**
 * Hand the tab to `/login`, keeping the screen as it is until the login screen
 * replaces it.
 *
 * @remarks
 * Wiping the stores and the query cache while the page was still up repainted
 * the app the user was leaving: the account menu emptied, sections behind a
 * permission vanished and every list fell back to loading and refetched without
 * a token — then the boot splash played before the login screen. So the
 * screen's half of the session ends with the page, on `pagehide` (which also
 * fires for a page the back/forward cache keeps; one restored from there loads
 * again), the next load skips the splash, and the caller ends the rest at once
 * ({@link endSessionOffScreen}).
 *
 * The full page load stays on purpose: it is what guarantees nothing of this
 * session survives into the next one — the drafts, outboxes and file links
 * that modules keep in memory included.
 */
function leaveForLogin(): void {
  window.addEventListener('pagehide', clearLocalAuthState, { once: true });
  window.addEventListener('pageshow', reloadIfRestored);
  skipSplashOnNextLoad();
  window.location.href = AUTH_ROUTES.LOGIN;
}

/**
 * Why a session ended (the `session_ended` analytics `reason`).
 *
 * @remarks
 * `force_logout` is the one the user did not choose and the app did not time:
 * the server rejected the session (revoked, logout-all, expired refresh). Every
 * other value is a DELIBERATE end — `logout` (the user asked), `idle_timeout`
 * and `session_expired` (the app's own clocks), `cross_tab` (a sibling tab did
 * one of those) — and a deliberate end must not be undone by the login screen,
 * so those also suppress auto-Google sign-in (see {@link forceLogout}).
 */
export type SessionEndReason =
  'force_logout' | 'logout' | 'cross_tab' | 'idle_timeout' | 'session_expired';

/**
 * Clear every local trace of the session and hand the tab to `/login`.
 *
 * @remarks
 * The screen stays as it is until the login screen replaces it: what it shows
 * is cleared as the page goes ({@link leaveForLogin}), everything else at once.
 *
 * **Local only — this does NOT revoke the server session.** The refresh cookie
 * is HttpOnly and stays valid, so calling this on its own for a session that is
 * still alive signs nobody out: `/login` boots, the silent refresh succeeds, and
 * the guest-only guard bounces the user straight back into the app. It is the
 * right call only when the server session is already gone (a dead session in
 * the fetch client, a deleted account) or has just been revoked ({@link logout}).
 * Anything that means to END a live session — the user menu, the idle-timeout
 * dialog, the absolute session cap — must go through {@link logout}.
 */
export function forceLogout(opts: { reason?: SessionEndReason } = {}): void {
  const reason = opts.reason ?? 'force_logout';
  captureAnalyticsEvent(ANALYTICS_EVENTS.sessionEnded, { reason });
  // A deliberate end must not be undone by the login screen: with auto-Google
  // on, `/login` would start OAuth by itself and a live Google session signs
  // the user back in without a single click. A dead session (`force_logout`)
  // keeps the convenience — nobody asked to leave.
  if (reason !== 'force_logout') skipAutoGoogleSignIn();
  endSessionOffScreen();
  broadcastLogout();
  leaveForLogin();
}

export function handleCrossTabLogout(): void {
  captureAnalyticsEvent(ANALYTICS_EVENTS.sessionEnded, { reason: 'cross_tab' });
  // The broadcast does not say WHY the other tab ended the session, so assume
  // the case that must not be undone: a sibling that auto-started Google here
  // would sign the user back in behind the tab they just signed out of.
  skipAutoGoogleSignIn();
  if (window.location.pathname === AUTH_ROUTES.LOGIN) {
    // Already on the login screen: nothing on it shows the session, and no page load follows.
    clearLocalAuthState();
    return;
  }
  endSessionOffScreen();
  leaveForLogin();
}

export async function silentRefresh(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  const pending = doSilentRefresh(authGeneration).finally(() => {
    if (refreshPromise === pending) refreshPromise = null;
  });
  refreshPromise = pending;
  return pending;
}

let authBootstrapPromise: Promise<void> | null = null;
/** The sign-out this boot finishes on the server ({@link finishPendingRevoke}); settled once done. */
let pendingRevoke: Promise<void> | null = null;
/** A sign-in this load started before the bootstrap ({@link bootstrapWithSignIn}). */
let signInAtBoot: Promise<void> | null = null;

/**
 * Hand the auth bootstrap a sign-in this load is already completing, so the bootstrap
 * waits for it instead of asking `/auth/refresh`.
 *
 * @remarks
 * The OAuth hand-off starts its code exchange at boot (`oauth-callback-sign-in.ts`),
 * before the router or React exist. A refresh sent beside it would carry the previous
 * session's cookie while the exchange sets the new one, and whichever answer landed
 * last would own the cookie jar. Call it before {@link startAuthBootstrap}: the
 * sign-in's outcome is then the bootstrap's.
 */
export function bootstrapWithSignIn(signIn: Promise<void>): void {
  signInAtBoot = signIn;
}

/**
 * The bootstrap of a load that is completing a sign-in ({@link bootstrapWithSignIn}):
 * that sign-in's answer IS this boot's session. Never rejects, like the bootstrap
 * it stands in for — a failed sign-in is the callback page's to report, and leaves
 * a guest. Whatever it answers, the store stops loading: one that fails after its
 * token (`me/context`) has moved the auth generation on.
 */
async function settleSignInAtBoot(signIn: Promise<void>): Promise<void> {
  try {
    await signIn;
  } catch {
    if (!getAccessToken()) useAuthStore.getState().clearAuth();
  } finally {
    if (useAuthStore.getState().isLoading) useAuthStore.getState().setLoading(false);
  }
}

/**
 * Throw unless this boot has a session to ask the server for — the checks that come before any
 * `/auth/refresh`: a sign-out still owed to the server, no session hint, a session lapsed while
 * the browser was closed.
 */
function assertSessionToRestore(generation: number): void {
  // A sign-out the server never heard about comes first: restoring that
  // session is exactly what the user asked not to happen. This boot is a
  // guest's whatever the server answers, so the login screen does not wait
  // for the revoke — it finishes behind it, and a sign-in waits for it
  // instead (`settlePendingRevoke`).
  if (isRevokePending()) {
    pendingRevoke ??= finishPendingRevoke(generation);
    throw new Error('Signed out');
  }
  /*
   * No session hint: this browser has never signed in, or it signed out.
   * Either way there is nothing on the server to restore, and asking is a
   * round trip on the critical path of the login screen that can only ever
   * answer 401 — measured on a fresh visit, `/auth/refresh` was the single
   * backend call the login page made, and in production it is cross-origin
   * and over TLS.
   *
   * This is NOT authorizing on the hint, which the hint may never be used
   * for: it grants nothing and trusts nothing. It declines to ASK when the
   * answer is already known, and every interactive sign-in writes the hint
   * (`establishSession` → `markSessionStart`, reached by the email, OAuth
   * callback and MFA paths alike) while logout clears it.
   *
   * The one false negative is a browser whose localStorage was cleared
   * while its HttpOnly cookie survived — a selective wipe, not a normal
   * one. That visitor sees the login screen and signs in again, which is
   * the same outcome the old code produced whenever the refresh failed.
   */
  if (!hasSessionHint()) throw new Error('No session hint');
  // A session this browser left past its idle limit or its absolute cap is
  // not restored: refreshing first and checking afterwards handed a browser
  // left alone for hours its session back, every page load (E-2).
  const lapsed = lapsedSessionReason();
  if (lapsed) {
    endLapsedSessionAtBoot(lapsed, generation);
    throw new Error('Session lapsed');
  }
}

export function startAuthBootstrap(): Promise<void> {
  if (signInAtBoot) {
    authBootstrapPromise ??= settleSignInAtBoot(signInAtBoot);
    return authBootstrapPromise;
  }
  authBootstrapPromise ??= (async () => {
    const generation = authGeneration;
    try {
      assertSessionToRestore(generation);
      await silentRefresh();
    } catch (error) {
      if (generation !== authGeneration) return;
      // No usable answer says nothing about the session, which the refresh cookie may still hold:
      // the next guard to wait on the bootstrap — the login page's — asks again instead of
      // settling for this attempt.
      if (saidNothingAboutSession(error)) authBootstrapPromise = null;
      const { isAuthenticated } = useAuthStore.getState();
      if (!(isAuthenticated || getAccessToken())) {
        if (platformConfig.debugLogging) {
          console.info('[Bootstrap] No active session');
        }
        useAuthStore.getState().clearAuth();
      }
    } finally {
      if (generation === authGeneration && useAuthStore.getState().isLoading) {
        useAuthStore.getState().setLoading(false);
      }
    }
  })();
  return authBootstrapPromise;
}

/**
 * Why the session this browser holds may not be restored at boot, if it may not: older than the
 * absolute cap (`session_expired`), or no activity in any tab for the idle limit
 * (`idle_timeout`) — read from the stored stamps, before anything records new activity.
 */
function lapsedSessionReason(): 'idle_timeout' | 'session_expired' | null {
  if (isSessionExpired()) return 'session_expired';
  const idle = idleFor();
  return idle !== null && idle >= IDLE_LOGOUT_AFTER_MS ? 'idle_timeout' : null;
}

/**
 * End, at boot, a session the app's own clocks have already ended — the boot-time half of
 * {@link logout}.
 *
 * @remarks
 * Ending a session is a server-side act, but a page load has no access token to revoke it
 * with (it lives in memory only), and {@link logout} would send the revoke without one and
 * then reload the tab onto `/login`, dropping the deep link. So it is ended the way a sign-out
 * whose revoke never landed is: the revoke is marked pending and finished behind the login
 * screen ({@link finishPendingRevoke} — a refresh only to mint the token the revoke needs, the
 * session never hydrated). The boot stays a guest's, the guards send the user to `/login` with
 * the deep link, and the end is deliberate, so auto-Google may not undo it.
 */
function endLapsedSessionAtBoot(
  reason: 'idle_timeout' | 'session_expired',
  generation: number,
): void {
  captureAnalyticsEvent(ANALYTICS_EVENTS.sessionEnded, { reason });
  skipAutoGoogleSignIn();
  clearSessionStart();
  clearActivity();
  markRevokePending();
  pendingRevoke ??= finishPendingRevoke(generation);
}

/**
 * True when a boot attempt failed without the server saying anything about the session: an
 * unanswered refresh, or `me/context` unreachable (status 0), throttled (429) or failing (5xx).
 */
function saidNothingAboutSession(error: unknown): boolean {
  if (isRefreshUnanswered(error)) return true;
  return (
    isHttpError(error) &&
    (error.status === 0 || error.status === 429 || error.status >= 500)
  );
}

export async function awaitAuthBootstrap(): Promise<void> {
  await startAuthBootstrap();
}

const authBase = () => `${platformConfig.apiBaseUrl}${API_BASE_PATH}`;

export async function refreshAccessToken(): Promise<void> {
  if (tokenRefreshPromise) return tokenRefreshPromise;
  const generation = authGeneration;
  const pending = runExclusiveRefresh({ generation, tokenWhenAsked: getAccessToken() })
    .catch((error: unknown) => {
      if (generation === authGeneration) throw error;
    })
    .finally(() => {
      if (tokenRefreshPromise === pending) tokenRefreshPromise = null;
    });
  tokenRefreshPromise = pending;
  return pending;
}

/**
 * Resolves once the refresh in flight, if any, has settled — whatever its outcome.
 *
 * @remarks
 * clinozy-be keeps one live access token per session, and a refresh and a workspace switch each
 * retire the token before them. A switch sent while a refresh is in flight can be answered first;
 * the refresh's answer would then put its own token back, minted for the workspace being left.
 * `shared/tenancy/switch.ts` waits on this before it sends the switch. A failed refresh is the
 * switch's own request to report, so the outcome is swallowed here.
 */
export async function settleInFlightRefresh(): Promise<void> {
  const pending = tokenRefreshPromise;
  if (!pending) return;
  await pending.catch(() => undefined);
}

/**
 * The refresh itself, behind the cross-tab Web Lock. clinozy-be keeps one live access token per
 * session and a refresh retires the one before it, so a refresh that waited for the lock while a
 * newer token arrived (a workspace switch, a sign-in) does not rotate again: that would retire the
 * token the app now carries and the requests in flight with it.
 */
async function runExclusiveRefresh({
  generation,
  tokenWhenAsked,
}: {
  generation: number;
  tokenWhenAsked: string | null;
}): Promise<void> {
  const refresh = async () => {
    if (generation !== authGeneration) return;
    const currentToken = getAccessToken();
    if (currentToken !== null && currentToken !== tokenWhenAsked) return;
    const refreshed = await fetchRefreshTokenRetryingOnce(generation);
    if (refreshed === null || generation !== authGeneration) return;
    const token = await onThisTabsOrganization({ token: refreshed, generation });
    if (token === null || generation !== authGeneration) return;
    setAccessToken(token);
    scheduleTokenRefresh();
  };
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`${PRODUCT_NAMESPACE}-auth:refresh`, refresh);
  }
  return refresh();
}

/**
 * The refreshed token, on the organization this tab shows.
 *
 * @remarks
 * clinozy-be keeps one live access token per session, scoped to the organization the session was
 * last switched to. Another tab's switch — or a switch of this tab whose answer never arrived —
 * makes the refresh answer with a token for that other organization. Carried here, it would read
 * and write the other organization's records under this tab's screen, so the tab switches back
 * first, inside the refresh lock, before any request carries it. A switch the server refuses
 * (membership ended, a security policy) hands the tab to the `/` resolver; one with no usable
 * answer fails the request as unreachable. Either way the other organization's token is dropped.
 */
async function onThisTabsOrganization({
  token,
  generation,
}: {
  token: string;
  generation: number;
}): Promise<string | null> {
  // The organization this tab works in: the one its `me/context` names, which only that read and a
  // completed switch write. The org store is not it — before `me/context` it holds the URL's
  // placeholder (a slug, the localhost fallback), never an organization the server knows.
  const active =
    queryClient.getQueryData<MeContext>(meContextQueryKey)?.activeOrganization;
  const claim = organizationClaimOf(token);
  // A token naming no organization reaches no organization's records; only another one is a risk.
  if (!active || claim === null || claim === active.id) return token;
  const personal = active.type === 'PERSONAL';
  let response: Response;
  try {
    response = await authFetch(
      `${authBase()}${personal ? '/auth/switch-to-personal' : '/auth/switch-to-organization'}`,
      {
        method: 'POST',
        timeout: HTTP.REFRESH_TIMEOUT,
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(personal ? {} : { organization_id: active.id }),
      },
    );
  } catch (error) {
    throw new RefreshUnansweredError(
      error instanceof Error ? error.message : 'Workspace switch got no answer',
    );
  }
  if (generation !== authGeneration) return null;
  if (response.status === 429 || response.status >= 500) {
    throw new RefreshUnansweredError(`Workspace switch failed (${response.status})`);
  }
  if (!response.ok) {
    window.location.href = '/';
    throw new RefreshUnansweredError(`Workspace switch refused (${response.status})`);
  }
  const switched = accessTokenOf(await response.json().catch(() => null));
  if (!switched)
    throw new RefreshUnansweredError('Workspace switch answered without a token');
  return switched;
}

/**
 * The server ANSWERED the refresh and said no — as opposed to a request that
 * never got an answer (offline, timeout). Only the former proves there is no
 * session left to revoke; see {@link finishPendingRevoke}.
 */
class RefreshRejectedError extends Error {}

/**
 * The refresh got no usable answer: no response at all (offline, timed out), a throttle (429) or a
 * server fault (5xx). Unlike {@link RefreshRejectedError} it says nothing about the session, which
 * may be perfectly alive — so it never signs anyone out by itself.
 */
class RefreshUnansweredError extends Error {}

/**
 * True when a refresh failed without the server saying anything about the session.
 *
 * @remarks
 * The 401 handler in `core/http/fetch-client.ts` asks this before signing anyone out: such a
 * failure — already retried once inside clinozy-be's refresh grace — fails the request as
 * unreachable and keeps the session; only a refused refresh ends it.
 */
export function isRefreshUnanswered(error: unknown): boolean {
  return error instanceof RefreshUnansweredError;
}

/** The pause before the one retry of an unanswered refresh. */
const REFRESH_RETRY_DELAY_MS = 600;

/**
 * One refresh, retried ONCE when it got no usable answer. Once only: a request that timed out may
 * already have rotated the refresh cookie on the server without the new one reaching the browser,
 * and clinozy-be accepts the superseded secret for 10 seconds only (`REFRESH_TOKEN_REUSE_GRACE_MS`)
 * — the retry lands well inside that (`HTTP.REFRESH_TIMEOUT` + this delay), where a second retry
 * could land outside it and read as a replay, which revokes every session of the user.
 *
 * @returns the new access token, or `null` when a newer sign-in or sign-out superseded the wait.
 */
async function fetchRefreshTokenRetryingOnce(generation: number): Promise<string | null> {
  try {
    return await fetchRefreshToken();
  } catch (error) {
    if (!(error instanceof RefreshUnansweredError)) throw error;
    await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
    if (generation !== authGeneration) return null;
    return fetchRefreshToken();
  }
}

/** POST /auth/refresh; no response at all (offline, timed out) is an unanswered refresh. */
async function postRefresh(): Promise<Response> {
  try {
    return await authFetch(`${authBase()}${API_ENDPOINTS.AUTH.REFRESH}`, {
      method: 'POST',
      timeout: HTTP.REFRESH_TIMEOUT,
    });
  } catch (error) {
    throw new RefreshUnansweredError(
      error instanceof Error ? error.message : 'Refresh got no answer',
    );
  }
}

/** The refusal's own words from the error envelope, else a status line. */
function refusalMessage(data: unknown, status: number): string {
  const envelope = data as { message?: string; error?: { detail?: string } } | null;
  return envelope?.error?.detail ?? envelope?.message ?? `Refresh failed (${status})`;
}

/** The access token in a refresh answer (enveloped or bare, snake or camel case). */
function accessTokenOf(data: unknown): string | undefined {
  const payload =
    data && typeof data === 'object' && 'data' in data
      ? (data as { data: unknown }).data
      : data;
  const raw = payload as { access_token?: string; accessToken?: string } | null;
  return raw?.access_token ?? raw?.accessToken;
}

async function fetchRefreshToken(): Promise<string> {
  const response = await postRefresh();
  if (response.status === 429 || response.status >= 500) {
    throw new RefreshUnansweredError(`Refresh failed (${response.status})`);
  }
  const data = (await response.json()) as unknown;
  if (!response.ok) throw new RefreshRejectedError(refusalMessage(data, response.status));

  const token = accessTokenOf(data);
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`Refresh failed (${response.status})`);
  }
  return token;
}

function meContextToAuthUser(ctx: MeContext): AuthUser {
  const name = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ');
  return {
    id: ctx.user.id,
    email: ctx.user.email,
    role: ctx.globalRole ?? 'user',
    name: name.length > 0 ? name : undefined,
    jobTitle: ctx.user.jobTitle ?? undefined,
    avatarUrl: ctx.user.avatarUrl ?? undefined,
    organizationId: ctx.activeOrganization?.id,
  };
}

async function hydrateSessionFromContext(generation: number): Promise<void> {
  const ctx = await hydrateSessionContext(() => generation === authGeneration);
  if (generation === authGeneration) {
    useAuthStore.getState().setUser(meContextToAuthUser(ctx));
  }
}

async function doSilentRefresh(generation: number): Promise<void> {
  await refreshAccessToken();
  if (generation !== authGeneration) return;
  try {
    await hydrateSessionFromContext(generation);
  } catch (error) {
    if (generation !== authGeneration) return;
    clearAccessToken();
    throw error;
  }
}

export async function establishSession(accessToken: string): Promise<void> {
  const generation = beginAuthGeneration();
  // An interactive sign-in supersedes any sign-out still waiting to reach the
  // server: the old refresh cookie has just been replaced, and a marker left
  // behind would revoke THIS session on the next boot.
  clearRevokePending();
  setAccessToken(accessToken);
  markSessionStart();
  // Signing in is activity: the idle clock a load or the dialog reads starts here, not at a
  // stamp the previous session left.
  markActivity();
  try {
    await hydrateSessionFromContext(generation);
    if (generation === authGeneration) scheduleTokenRefresh();
  } catch (error) {
    if (generation !== authGeneration) return;
    clearAccessToken();
    clearSessionStart();
    throw error;
  }
}

// Derived from `PRODUCT_NAMESPACE`, like the session-start key beside it.
const REVOKE_PENDING_KEY = `${PRODUCT_NAMESPACE}:logout-pending`;

/**
 * "The user signed out, but the server has not been told yet."
 *
 * A flag, never a token. It exists because the revoke is a network call and the
 * commonest moment for an idle sign-out is a laptop waking from sleep — the
 * deadline passes while the lid is shut, and Wi-Fi is not back yet when the
 * timer fires. Local state is cleared either way, but the HttpOnly refresh
 * cookie is still good, so the next load would silently restore the very
 * session the timeout existed to end. The boot path finishes the job instead
 * ({@link finishPendingRevoke}).
 */
function markRevokePending(): void {
  try {
    localStorage.setItem(REVOKE_PENDING_KEY, '1');
  } catch {
    /* storage unavailable (private mode) — the revoke stays best-effort */
  }
}

function clearRevokePending(): void {
  try {
    localStorage.removeItem(REVOKE_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * A sign-out this browser has not yet finished on the server (the
 * `logout-pending` flag {@link logout} leaves when the revoke could not be sent).
 *
 * @remarks
 * The next boot finishes it before anything else (`startAuthBootstrap`), and a
 * sign-in waits for that (`settlePendingRevoke`). The OAuth hand-off reads it to
 * leave its code exchange to that order instead of starting it at boot.
 */
export function isRevokePending(): boolean {
  try {
    return localStorage.getItem(REVOKE_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * POST `/auth/logout` for a session token. Resolves `true` once revoked.
 *
 * `keepalive` is what lets the caller redirect without waiting: {@link forceLogout} hands the tab
 * to `/login` with `window.location.href`, and a plain in-flight fetch dies with the document.
 * A keepalive request is the one kind the browser promises to finish across unload, so the revoke
 * still reaches the server after the user is already looking at the login screen. The response
 * usually arrives too late to observe — which is why the caller marks the revoke pending FIRST and
 * treats this resolving as the bonus, not the guarantee.
 *
 * Takes the token explicitly because the instant path reads it before `forceLogout()` wipes
 * it: clinozy-be identifies the session to revoke BY the bearer token and 401s without one — expired
 * is fine, absent is not. Without it the refresh cookie survives and the `/login` bootstrap signs
 * the user straight back in.
 */
async function revokeServerSession(
  token: string | null = getAccessToken(),
  options: { keepalive?: boolean } = {},
): Promise<boolean> {
  const res = await authFetch(`${authBase()}${API_ENDPOINTS.AUTH.LOGOUT}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    ...(options.keepalive ? { keepalive: true } : {}),
  });
  if (!res.ok && platformConfig.debugLogging) {
    console.error('[Auth] Server-side session revoke failed', res.status);
  }
  return res.ok;
}

/**
 * Boot-time half of a sign-out whose revoke never landed.
 *
 * The access token lives in memory only, so after a reload there is nothing to
 * revoke WITH. Mint one from the refresh cookie, spend it on `/auth/logout`, and
 * drop it again — the session is never hydrated, so the caller stays a guest.
 * The marker survives only while the outcome is unknown (still offline); a
 * refresh the server REJECTS means there is no session left to revoke.
 */
async function finishPendingRevoke(generation: number): Promise<void> {
  try {
    await refreshAccessToken();
    if (generation !== authGeneration) return;
    if (await revokeServerSession()) clearRevokePending();
  } catch (error) {
    if (error instanceof RefreshRejectedError) clearRevokePending();
  } finally {
    if (generation === authGeneration) {
      cancelTokenRefresh();
      clearAccessToken();
    }
  }
}

/**
 * The sign-out the boot found still owed to the server, for a caller to await: it settles once the
 * revoke has finished, or given up for now (`null` when there was none).
 *
 * @remarks
 * That boot shows the login screen at once and finishes the revoke behind it
 * ({@link startAuthBootstrap}). The revoke refreshes first, and a refresh answer
 * sets the refresh cookie: one landing after a new sign-in's would put the
 * signed-out session's cookie back over the new one. So every sign-in request
 * waits for this before it goes (`authFetch` in `shared/api/auth-api.ts`), and
 * the old session's last answer is always in before the new one's first. By the
 * time anyone has typed an address it has long settled. Never rejects.
 */
export function settlePendingRevoke(): Promise<void> | null {
  return pendingRevoke;
}

let logoutPromise: Promise<void> | null = null;

/**
 * Sign out — revoke the session server-side, then clear everything locally.
 *
 * @remarks
 * The ONE way to end a live session: the user menu, the command palette, the
 * idle-timeout dialog (its "Sign out" button AND its deadline) and the absolute
 * session cap all come through here. `reason` only labels the analytics event.
 *
 * **Single-flight.** The menu item is an async handler with no `disabled` state
 * to speak of, and the command palette and the session-timeout dialog can fire
 * it too. A second call would POST `/auth/logout` again — the first has already
 * cleared the access token by then, so it goes out unauthenticated against a
 * backend that treats refresh-session reuse as an attack. One gesture, one
 * revoke (agent-os/rules/fe-resilient-interactions.mdc section 1).
 */
export async function logout(
  opts: { reason?: Exclude<SessionEndReason, 'force_logout' | 'cross_tab'> } = {},
): Promise<void> {
  logoutPromise ??= doLogout(opts.reason ?? 'logout').finally(() => {
    logoutPromise = null;
  });
  return logoutPromise;
}

async function doLogout(reason: SessionEndReason): Promise<void> {
  // Signing out does not wait for the network. This used to await the revoke before handing the
  // tab to /login, so a slow or hanging `/auth/logout` left the user sitting on the app they had
  // just asked to leave — the one moment where a spinner reads as "did that work?".
  //
  // Leaving instantly is only safe because of the two lines below. The refresh cookie is HttpOnly
  // and survives `forceLogout()`, so a redirect with a live server session would let the
  // /login bootstrap silently refresh and bounce the user back into the app. Marking the revoke
  // pending BEFORE leaving is what stops that: the bootstrap sees the marker, refuses to restore
  // the session, and finishes the revoke itself behind the login screen (`finishPendingRevoke`).
  // Pessimistic on purpose — the marker is cleared only by a revoke we actually saw succeed.
  const token = getAccessToken();
  markRevokePending();
  void revokeServerSession(token, { keepalive: true })
    .then((revoked) => {
      if (revoked) clearRevokePending();
    })
    .catch(() => {
      /* best-effort — the pending marker and the next boot are the real guarantee */
    });
  forceLogout({ reason });
}
