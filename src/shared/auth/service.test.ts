import { type Mock, vi } from 'vitest';

import { platformConfig } from '@/core/config/env.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { APP_SPLASH_SKIP } from '@/lib/app-splash.ts';
import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type { MeContext } from '@/shared/tenancy/me-context.ts';
import { hydrateSessionContext } from '@/shared/tenancy/session-context.ts';

import { shouldAttemptAutoGoogleSignIn } from './auto-google-sign-in.ts';
import { cancelTokenRefresh } from './refresh-timer.ts';
import { clearAccessToken, getAccessToken, setAccessToken } from './token.ts';
import type { AuthUser } from './types.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

// Mock global fetch
let fetchMock: ReturnType<typeof vi.fn>;

const { fetchMeContextMock, setQueryDataMock, getQueryDataMock } = vi.hoisted(() => ({
  fetchMeContextMock: vi.fn(),
  setQueryDataMock: vi.fn(),
  getQueryDataMock: vi.fn(),
}));

vi.mock('@/core/http/queryClient.ts', () => ({
  queryClient: {
    clear: vi.fn(),
    setQueryData: setQueryDataMock,
    getQueryData: getQueryDataMock,
    removeQueries: vi.fn(),
    // Session hydration also starts the organization list (a cache-first read).
    query: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('@/shared/tenancy/me-context.ts', () => ({
  fetchMeContext: fetchMeContextMock,
  meContextQueryKey: ['auth', 'me-context'],
}));

vi.mock('@/shared/auth/refresh-timer.ts', () => ({
  scheduleTokenRefresh: vi.fn(),
  cancelTokenRefresh: vi.fn(),
}));

/** Helper to create a minimal JWT (base64url) */
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

const VALID_TOKEN = makeJwt({ sub: 'user1', exp: 9999999999 });
const MOCK_USER: AuthUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'admin',
  organizationId: 'org_test1',
  name: 'Test User',
};

const SAMPLE_CTX: MeContext = {
  user: {
    id: 'usr_1',
    email: 'ada@acme.test',
    isEmailVerified: true,
    isMfaEnabled: false,
    firstName: 'Ada',
    lastName: 'Byron',
    avatarUrl: null,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  activeOrganization: {
    id: 'org_1',
    name: 'Acme',
    slug: 'acme',
    type: 'TEAM',
    status: 'ACTIVE',
    logoUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  myPermissions: ['organization:read'],
  globalRole: null,
  organizations: [],
  deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
  personalOrganizationId: null,
};

function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

import type * as AuthServiceModule from './service.ts';

describe('auth/service', () => {
  let silentRefresh: AuthServiceModule['silentRefresh'];
  let forceLogout: AuthServiceModule['forceLogout'];
  let handleCrossTabLogout: AuthServiceModule['handleCrossTabLogout'];
  let logout: AuthServiceModule['logout'];
  let refreshAccessToken: AuthServiceModule['refreshAccessToken'];
  let isRefreshUnanswered: AuthServiceModule['isRefreshUnanswered'];
  let establishSession: AuthServiceModule['establishSession'];
  let startAuthBootstrap: AuthServiceModule['startAuthBootstrap'];
  let endRefusedSession: AuthServiceModule['endRefusedSession'];

  beforeAll(async () => {
    const mod = await import('./service.ts');
    silentRefresh = mod.silentRefresh;
    forceLogout = mod.forceLogout;
    handleCrossTabLogout = mod.handleCrossTabLogout;
    logout = mod.logout;
    refreshAccessToken = mod.refreshAccessToken;
    isRefreshUnanswered = mod.isRefreshUnanswered;
    establishSession = mod.establishSession;
    startAuthBootstrap = mod.startAuthBootstrap;
    endRefusedSession = mod.endRefusedSession;
  });

  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    clearAccessToken();
    useOrganizationStore.getState().clearOrganization();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('forceLogout', () => {
    /** The browser leaving the page — the one moment what the screen shows may go. */
    const leaveThePage = () => window.dispatchEvent(new Event('pagehide'));

    it('clears the token at once and hands the tab to /login', () => {
      setAccessToken(VALID_TOKEN);
      useAuthStore.getState().setUser(MOCK_USER);

      forceLogout();

      expect(getAccessToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('keeps the screen as it is until the page goes, then clears what it showed', () => {
      // Clearing the stores while the page was still up repainted the app being
      // left: the account menu emptied, gated sections vanished, lists reloaded.
      setAccessToken(VALID_TOKEN);
      useAuthStore.getState().setUser(MOCK_USER);
      useOrganizationStore.getState().setOrganization('org_prev', 'acme', 'active');

      forceLogout();

      expect(useAuthStore.getState().user).toEqual(MOCK_USER);
      expect(useOrganizationStore.getState().organizationId).toBe('org_prev');

      leaveThePage();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('wipes the active-org context + RBAC permissions (no privilege bleed to next sign-in)', () => {
      setAccessToken(VALID_TOKEN);
      useAuthStore.getState().setUser(MOCK_USER);
      // Seed an org context with elevated grants, as if a session were active.
      useOrganizationStore.getState().setOrganization('org_prev', 'acme', 'active');
      useOrganizationStore.setState({ permissions: ['membership:update'] });

      forceLogout();
      leaveThePage();

      // Cleared in memory, not left to the reload — a page the back/forward
      // cache keeps must not hold one user's grants either.
      expect(useOrganizationStore.getState().organizationId).toBeNull();
      expect(useOrganizationStore.getState().permissions).toEqual([]);
    });

    it('wipes persisted onboarding progress (no wizard/PII leak to the next user)', () => {
      setAccessToken(VALID_TOKEN);
      // Simulate a user mid-wizard: owner bound, name typed, step advanced.
      const onboarding = useOnboardingStore.getState();
      onboarding.claimForUser('usr_prev');
      onboarding.patch({ firstName: 'Prev', lastName: 'User' });
      onboarding.setStepIndex(3);
      const storageKey = useOnboardingStore.persist.getOptions().name ?? '';
      expect(localStorage.getItem(storageKey)).toContain('Prev');

      forceLogout();

      // What the next load would read is gone before the tab leaves...
      expect(localStorage.getItem(storageKey)).toBeNull();

      leaveThePage();

      // ...and the NEXT user on this browser starts the wizard from scratch —
      // otherwise their finish step submits the PREVIOUS user's name.
      const state = useOnboardingStore.getState();
      expect(state.stepIndex).toBe(0);
      expect(state.data.firstName).toBe('');
      expect(state.data.lastName).toBe('');
      expect(state.forUserId).toBeNull();
    });

    it('lets the login load skip the boot splash — under the key splash-init.js reads', () => {
      sessionStorage.removeItem(APP_SPLASH_SKIP);

      forceLogout();

      expect(sessionStorage.getItem(APP_SPLASH_SKIP)).toBe('1');
    });

    it('loads a page the back/forward cache restored again instead of showing it', () => {
      const reload = vi.fn();
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '', reload },
      });

      forceLogout();
      leaveThePage();
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
      expect(reload).not.toHaveBeenCalled();
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

      expect(reload).toHaveBeenCalledOnce();
    });
  });

  describe('a clean-up step that throws', () => {
    afterEach(() => {
      platformConfig.debugLogging = false;
    });

    it('never stops the tab from leaving — and is reported when debugging', () => {
      platformConfig.debugLogging = true;
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      (cancelTokenRefresh as Mock).mockImplementation(() => {
        throw new Error('timer');
      });
      (queryClient.clear as Mock).mockImplementation(() => {
        throw new Error('cache');
      });
      useAuthStore.getState().setUser(MOCK_USER);

      forceLogout();
      expect(window.location.href).toBe('/login');
      window.dispatchEvent(new Event('pagehide'));

      expect(useAuthStore.getState().user).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        '[Auth] Cleanup failed during logout',
        expect.objectContaining({ message: 'cache' }),
      );
      consoleError.mockRestore();
    });
  });

  describe('handleCrossTabLogout', () => {
    it('leaves another page like forceLogout — its screen stays until the page goes', () => {
      window.location.pathname = '/organization/acme/today';
      setAccessToken(VALID_TOKEN);
      useAuthStore.getState().setUser(MOCK_USER);

      handleCrossTabLogout();

      expect(getAccessToken()).toBeNull();
      expect(window.location.href).toBe('/login');
      expect(useAuthStore.getState().user).toEqual(MOCK_USER);
      window.dispatchEvent(new Event('pagehide'));
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('clears at once on the login screen, where no page load follows', () => {
      window.location.pathname = '/login';
      useAuthStore.getState().setUser(MOCK_USER);

      handleCrossTabLogout();

      expect(window.location.href).toBe('');
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('silentRefresh', () => {
    it('sets token and user on success', async () => {
      fetchMeContextMock.mockResolvedValueOnce(SAMPLE_CTX);
      (fetchMock as Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
      );

      await silentRefresh();

      expect(getAccessToken()).toBe(VALID_TOKEN);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe('ada@acme.test');
    });

    it('rolls back token if context fetch fails', async () => {
      (fetchMock as Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
      );
      fetchMeContextMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(silentRefresh()).rejects.toThrow('Network error');
      expect(getAccessToken()).toBeNull();
    });

    it('rejects if refresh endpoint fails', async () => {
      // Unanswered twice (the try and its one retry), so the refresh gives up.
      (fetchMock as Mock).mockRejectedValue(new Error('401'));

      await expect(silentRefresh()).rejects.toThrow('401');
      expect(getAccessToken()).toBeNull();
    });

    it('deduplicates concurrent calls (mutex)', async () => {
      fetchMeContextMock.mockResolvedValue(SAMPLE_CTX);
      (fetchMock as Mock).mockResolvedValue(
        mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
      );

      const [r1, r2] = await Promise.all([silentRefresh(), silentRefresh()]);

      expect(r1).toBeUndefined();
      expect(r2).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAccessToken (the ONE single-flight)', () => {
    /*
     * One live token per session, scoped to the organization the session was last switched to.
     * With this tab on clinic A and another tab switched to clinic B, the refresh answers with a
     * B token — carried here it would read and write clinic B's records under clinic A's screen.
     */
    describe('a refreshed token for another organization than this tab shows', () => {
      const TOKEN_FOR_B = makeJwt({ sub: 'user1', org: 'org_b', exp: 9999999999 });
      const TOKEN_FOR_A = makeJwt({ sub: 'user1', org: 'org_a', exp: 9999999999 });

      /** This tab's `me/context`, on organization A. */
      function tabOnOrganization(type: 'TEAM' | 'PERSONAL') {
        getQueryDataMock.mockReturnValue({
          ...SAMPLE_CTX,
          activeOrganization: { ...SAMPLE_CTX.activeOrganization, id: 'org_a', type },
        });
      }

      beforeEach(() => {
        tabOnOrganization('TEAM');
      });

      it('takes no action before this tab has read its context (the store holds a URL placeholder)', async () => {
        getQueryDataMock.mockReturnValue(undefined);
        useOrganizationStore.setState({
          organizationId: 'default',
          organizationType: 'TEAM',
        });
        (fetchMock as Mock).mockResolvedValueOnce(
          mockFetchResponse({ data: { access_token: TOKEN_FOR_B } }),
        );

        await refreshAccessToken();

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(getAccessToken()).toBe(TOKEN_FOR_B);
      });

      it('switches this tab back to its own organization before the token is used', async () => {
        (fetchMock as Mock)
          .mockResolvedValueOnce(
            mockFetchResponse({ data: { access_token: TOKEN_FOR_B } }),
          )
          .mockResolvedValueOnce(
            mockFetchResponse({ data: { access_token: TOKEN_FOR_A } }),
          );

        await refreshAccessToken();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [switchUrl, switchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(switchUrl).toContain('/auth/switch-to-organization');
        expect(JSON.parse(String(switchInit.body))).toEqual({ organization_id: 'org_a' });
        expect((switchInit.headers as Record<string, string>).Authorization).toBe(
          `Bearer ${TOKEN_FOR_B}`,
        );
        expect(getAccessToken()).toBe(TOKEN_FOR_A);
      });

      it('keeps a refreshed token that already names this tab organization', async () => {
        (fetchMock as Mock).mockResolvedValueOnce(
          mockFetchResponse({ data: { access_token: TOKEN_FOR_A } }),
        );

        await refreshAccessToken();

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(getAccessToken()).toBe(TOKEN_FOR_A);
      });

      it('switches a personal workspace tab back through switch-to-personal', async () => {
        tabOnOrganization('PERSONAL');
        (fetchMock as Mock)
          .mockResolvedValueOnce(
            mockFetchResponse({ data: { access_token: TOKEN_FOR_B } }),
          )
          .mockResolvedValueOnce(
            mockFetchResponse({ data: { access_token: TOKEN_FOR_A } }),
          );

        await refreshAccessToken();

        expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
          '/auth/switch-to-personal',
        );
        expect(getAccessToken()).toBe(TOKEN_FOR_A);
      });

      it('never keeps the other organization token when the switch back gets no answer', async () => {
        (fetchMock as Mock)
          .mockResolvedValueOnce(
            mockFetchResponse({ data: { access_token: TOKEN_FOR_B } }),
          )
          .mockResolvedValueOnce(mockFetchResponse({ message: 'busy' }, 503));

        const error = await refreshAccessToken().catch((caught: unknown) => caught);

        expect(isRefreshUnanswered(error)).toBe(true);
        expect(getAccessToken()).not.toBe(TOKEN_FOR_B);
      });

      it('hands the tab to the resolver when the switch back is refused', async () => {
        (fetchMock as Mock)
          .mockResolvedValueOnce(
            mockFetchResponse({ data: { access_token: TOKEN_FOR_B } }),
          )
          .mockResolvedValueOnce(mockFetchResponse({ message: 'not a member' }, 403));

        const error = await refreshAccessToken().catch((caught: unknown) => caught);

        // Not a sign-out: the session is fine, this tab's organization is not the caller's any more.
        expect(isRefreshUnanswered(error)).toBe(true);
        expect(window.location.href).toBe('/');
        expect(getAccessToken()).not.toBe(TOKEN_FOR_B);
      });
    });

    it('concurrent calls share ONE /auth/refresh request', async () => {
      (fetchMock as Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
      );

      // jsdom has no navigator.locks, so this also covers the fallback path.
      await Promise.all([refreshAccessToken(), refreshAccessToken()]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/auth/refresh');
      expect(getAccessToken()).toBe(VALID_TOKEN);
    });

    it('a failed refresh clears the in-flight slot so the next call retries', async () => {
      (fetchMock as Mock)
        .mockResolvedValueOnce(mockFetchResponse({ message: 'session revoked' }, 401))
        .mockResolvedValueOnce(
          mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
        );

      await expect(refreshAccessToken()).rejects.toThrow('session revoked');
      await refreshAccessToken();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getAccessToken()).toBe(VALID_TOKEN);
    });

    it('a refresh with no usable answer (5xx, 429, offline) is retried once and can succeed', async () => {
      (fetchMock as Mock)
        .mockResolvedValueOnce(mockFetchResponse({ message: 'busy' }, 503))
        .mockResolvedValueOnce(
          mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
        );

      await refreshAccessToken();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getAccessToken()).toBe(VALID_TOKEN);
    });

    it('retries an unanswered refresh ONCE only — a second try could fall outside the reuse grace', async () => {
      (fetchMock as Mock)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(mockFetchResponse({ message: 'slow down' }, 429));

      const error = await refreshAccessToken().catch((caught: unknown) => caught);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // It says nothing about the session, so nothing signs out on it.
      expect(isRefreshUnanswered(error)).toBe(true);
    });

    it('a refresh the server refused is not retried and is no "unanswered" one', async () => {
      (fetchMock as Mock).mockResolvedValueOnce(
        mockFetchResponse({ message: 'session revoked' }, 401),
      );

      const error = await refreshAccessToken().catch((caught: unknown) => caught);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(isRefreshUnanswered(error)).toBe(false);
    });

    it('serializes through the cross-tab Web Lock when navigator.locks exists', async () => {
      const lockRequest = vi.fn(
        (_name: string, cb: () => Promise<unknown>): Promise<unknown> => cb(),
      );
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: { request: lockRequest },
      });
      try {
        (fetchMock as Mock).mockResolvedValueOnce(
          mockFetchResponse({ accessToken: VALID_TOKEN }),
        );

        await refreshAccessToken();

        expect(lockRequest).toHaveBeenCalledTimes(1);
        expect(lockRequest.mock.calls[0]?.[0]).toBe(`${PRODUCT_NAMESPACE}-auth:refresh`);
        expect(getAccessToken()).toBe(VALID_TOKEN);
      } finally {
        delete (navigator as { locks?: unknown }).locks;
      }
    });

    // clinozy-be keeps one live access token per session: a refresh retires the token before it.
    // A refresh asked for before a newer token arrived (a workspace switch, a sign-in) must not
    // rotate again once it gets the lock — it would retire the token the app now carries.
    it('skips the rotation when a newer token arrived while it waited for the lock', async () => {
      let openLock!: () => void;
      const lockOpen = new Promise<void>((resolve) => {
        openLock = resolve;
      });
      const lockRequest = vi.fn(
        async (_name: string, cb: () => Promise<unknown>): Promise<unknown> => {
          await lockOpen;
          return cb();
        },
      );
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: { request: lockRequest },
      });
      const olderToken = makeJwt({ sub: 'older', exp: 9999999999 });
      const switchedToken = makeJwt({ sub: 'switched', exp: 9999999999 });
      try {
        setAccessToken(olderToken);
        const refreshing = refreshAccessToken();
        setAccessToken(switchedToken); // e.g. a workspace switch landed meanwhile
        openLock();
        await refreshing;

        expect(fetchMock).not.toHaveBeenCalled();
        expect(getAccessToken()).toBe(switchedToken);
      } finally {
        delete (navigator as { locks?: unknown }).locks;
      }
    });

    it('still rotates when the token is unchanged after waiting for the lock', async () => {
      let openLock!: () => void;
      const lockOpen = new Promise<void>((resolve) => {
        openLock = resolve;
      });
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: async (_name: string, cb: () => Promise<unknown>) => {
            await lockOpen;
            return cb();
          },
        },
      });
      try {
        setAccessToken(makeJwt({ sub: 'expiring', exp: 9999999999 }));
        (fetchMock as Mock).mockResolvedValueOnce(
          mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
        );
        const refreshing = refreshAccessToken();
        openLock();
        await refreshing;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getAccessToken()).toBe(VALID_TOKEN);
      } finally {
        delete (navigator as { locks?: unknown }).locks;
      }
    });
  });

  describe('logout', () => {
    it('calls logout endpoint and then forceLogout', async () => {
      (fetchMock as Mock).mockResolvedValueOnce(mockFetchResponse({}));
      setAccessToken(VALID_TOKEN);
      useAuthStore.getState().setUser(MOCK_USER);

      await logout();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(getAccessToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('revokes once for a double-clicked Sign out', async () => {
      // The menu item is a bare async onClick — two clicks in one frame both
      // get through. The second POST would go out AFTER the first cleared the
      // token, i.e. unauthenticated, against a backend that treats refresh
      // reuse as an attack.
      (fetchMock as Mock).mockResolvedValue(mockFetchResponse({}));
      setAccessToken(VALID_TOKEN);
      const logoutCalls = () =>
        (fetchMock as Mock).mock.calls.filter(([url]) =>
          String(url).includes('/auth/logout'),
        ).length;

      await Promise.all([logout(), logout()]);

      expect(logoutCalls()).toBe(1);
    });

    it('sends the current access token as the Authorization bearer', async () => {
      // Regression: clinozy-be revokes the session BY the bearer token and 401s
      // without one. logout() used to omit the header, so the server session
      // and refresh cookie survived and the /login bootstrap silently signed
      // the user straight back in — "Log out" was a visible no-op.
      (fetchMock as Mock).mockResolvedValueOnce(mockFetchResponse({}));
      setAccessToken(VALID_TOKEN);

      await logout();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${VALID_TOKEN}`,
          }),
        }),
      );
    });

    it('omits the Authorization header when no token is in memory', async () => {
      (fetchMock as Mock).mockResolvedValueOnce(mockFetchResponse({}));

      await logout();

      const headers = (fetchMock as Mock).mock.calls[0]?.[1]?.headers as Record<
        string,
        string
      >;
      expect(headers.Authorization).toBeUndefined();
      expect(window.location.href).toBe('/login');
    });

    it('still clears local state when the server refuses the revoke (non-2xx)', async () => {
      (fetchMock as Mock).mockResolvedValueOnce(
        mockFetchResponse({ error: { message: 'unauthorized' } }, 401),
      );
      setAccessToken(VALID_TOKEN);

      await logout();

      expect(getAccessToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('lands on /login without waiting for the revoke to answer', async () => {
      // The point of the change: signing out used to await `/auth/logout` before handing the tab
      // to /login, so a slow endpoint held the user on the app they had just asked to leave. The
      // request still goes out — it must, or the session lives on — but the redirect no longer
      // depends on the answer. A revoke that never settles proves it.
      let releaseRevoke: (value: unknown) => void = () => {};
      (fetchMock as Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          releaseRevoke = resolve;
        }),
      );
      setAccessToken(VALID_TOKEN);

      await logout();

      expect(window.location.href).toBe('/login');
      expect(getAccessToken()).toBeNull();
      // ...and the revoke was genuinely dispatched, with the token captured before local state
      // was cleared, and `keepalive` so the browser finishes it across the redirect.
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          keepalive: true,
          headers: expect.objectContaining({ Authorization: `Bearer ${VALID_TOKEN}` }),
        }),
      );
      releaseRevoke(mockFetchResponse({}));
    });

    it('marks the revoke pending before leaving, so /login cannot silently restore the session', async () => {
      // The refresh cookie is HttpOnly and outlives clearLocalAuthState(), so leaving before the
      // revoke lands would let the /login bootstrap refresh straight back into the app. The marker
      // is what makes the instant redirect safe — it must be written BEFORE the redirect, not
      // after the network answers.
      (fetchMock as Mock).mockReturnValueOnce(new Promise(() => {}));
      setAccessToken(VALID_TOKEN);

      await logout();

      expect(localStorage.getItem(`${PRODUCT_NAMESPACE}:logout-pending`)).toBe('1');
    });

    it('still clears state even if logout endpoint fails', async () => {
      (fetchMock as Mock).mockRejectedValueOnce(new Error('Network down'));
      setAccessToken(VALID_TOKEN);

      await logout();

      expect(getAccessToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });

  describe('establishSession', () => {
    it('seeds the me/context cache + header user from one canonical read', async () => {
      fetchMeContextMock.mockResolvedValueOnce(SAMPLE_CTX);

      await establishSession(VALID_TOKEN);

      expect(getAccessToken()).toBe(VALID_TOKEN);
      expect(setQueryDataMock).toHaveBeenCalledWith(['auth', 'me-context'], SAMPLE_CTX);
      const user = useAuthStore.getState().user;
      expect(user?.email).toBe('ada@acme.test');
      expect(user?.name).toBe('Ada Byron');
      expect(user?.organizationId).toBe('org_1');
    });

    it('rolls the token back if the context load fails', async () => {
      fetchMeContextMock.mockRejectedValueOnce(new Error('500'));

      await expect(establishSession(VALID_TOKEN)).rejects.toThrow('500');
      expect(getAccessToken()).toBeNull();
    });
  });
  describe('auth completion ordering', () => {
    const NEXT_TOKEN = makeJwt({ sub: 'next-user', exp: 9999999999 });
    const NEXT_CTX: MeContext = {
      ...SAMPLE_CTX,
      user: { ...SAMPLE_CTX.user, id: 'next-user' },
      activeOrganization: { ...SAMPLE_CTX.activeOrganization!, id: 'next-org' },
    };

    beforeEach(() => {
      forceLogout();
      fetchMeContextMock.mockReset().mockResolvedValue(SAMPLE_CTX);
      setQueryDataMock.mockClear();
      window.location.pathname = '/login';
    });

    it.each(['logout', 'new login'])(
      'invalidates default context readers on %s',
      async (change) => {
        const context = deferred<MeContext>();
        fetchMeContextMock
          .mockReturnValueOnce(context.promise)
          .mockResolvedValueOnce(NEXT_CTX);
        const pending = hydrateSessionContext();
        const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        if (change === 'logout') handleCrossTabLogout();
        else await establishSession(NEXT_TOKEN);
        setQueryDataMock.mockClear();
        context.resolve(SAMPLE_CTX);
        await rejected;
        expect(setQueryDataMock).not.toHaveBeenCalled();
        expect(useOrganizationStore.getState().organizationId).toBe(
          change === 'logout' ? null : 'next-org',
        );
        expect(getAccessToken()).toBe(change === 'logout' ? null : NEXT_TOKEN);
      },
    );

    it('does not restore a token when refresh finishes after cross-tab logout', async () => {
      const response = deferred<Response>();
      fetchMock.mockReturnValueOnce(response.promise);
      const refresh = refreshAccessToken();
      handleCrossTabLogout();
      response.resolve(mockFetchResponse({ data: { access_token: VALID_TOKEN } }));
      await refresh;
      expect(getAccessToken()).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('does not restore user, organization, or cache after cross-tab logout during context loading', async () => {
      const context = deferred<MeContext>();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
      );
      fetchMeContextMock.mockReturnValueOnce(context.promise);
      const refresh = silentRefresh();
      await vi.waitFor(() => expect(fetchMeContextMock).toHaveBeenCalledOnce());
      handleCrossTabLogout();
      context.resolve(SAMPLE_CTX);
      await refresh;
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useOrganizationStore.getState().organizationId).toBeNull();
      expect(setQueryDataMock).not.toHaveBeenCalled();
      expect(getAccessToken()).toBeNull();
    });

    it('does not send refresh after logout while waiting for the cross-tab lock', async () => {
      let grant!: () => Promise<void>;
      const lock = deferred<void>();
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: vi.fn((_name: string, callback: () => Promise<void>) => {
            grant = callback;
            return lock.promise;
          }),
        },
      });
      fetchMock.mockResolvedValue(
        mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
      );
      try {
        const refresh = refreshAccessToken();
        handleCrossTabLogout();
        await grant();
        lock.resolve();
        await refresh;
        expect(fetchMock).not.toHaveBeenCalled();
        expect(getAccessToken()).toBeNull();
      } finally {
        delete (navigator as Navigator & { locks?: unknown }).locks;
      }
    });

    it('preserves a newer login when an old refresh returns a token', async () => {
      const response = deferred<Response>();
      fetchMock.mockReturnValueOnce(response.promise);
      const refresh = refreshAccessToken();
      await establishSession(NEXT_TOKEN);
      response.resolve(mockFetchResponse({ data: { access_token: VALID_TOKEN } }));
      await refresh;
      expect(getAccessToken()).toBe(NEXT_TOKEN);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('ignores a stale refresh rejection after newer login', async () => {
      const response = deferred<Response>();
      fetchMock.mockReturnValueOnce(response.promise);
      const refresh = refreshAccessToken().then(
        () => 'settled',
        () => 'rejected',
      );
      await establishSession(NEXT_TOKEN);
      response.reject(new Error('old transport failed'));
      expect(await refresh).toBe('settled');
      expect(getAccessToken()).toBe(NEXT_TOKEN);
    });

    it('does not clear a newer login when old context hydration fails', async () => {
      const context = deferred<MeContext>();
      fetchMeContextMock
        .mockReturnValueOnce(context.promise)
        .mockResolvedValueOnce(NEXT_CTX);
      const older = establishSession(VALID_TOKEN).then(
        () => 'settled',
        () => 'rejected',
      );
      await establishSession(NEXT_TOKEN);
      context.reject(new Error('old context failed'));
      expect(await older).toBe('settled');
      expect(getAccessToken()).toBe(NEXT_TOKEN);
      expect(useAuthStore.getState().user?.id).toBe('next-user');
    });

    it('does not overwrite a newer login when old context hydration succeeds', async () => {
      const context = deferred<MeContext>();
      fetchMeContextMock
        .mockReturnValueOnce(context.promise)
        .mockResolvedValueOnce(NEXT_CTX);
      const older = establishSession(VALID_TOKEN);
      await establishSession(NEXT_TOKEN);
      setQueryDataMock.mockClear();
      context.resolve(SAMPLE_CTX);
      await older;
      expect(useAuthStore.getState().user?.id).toBe('next-user');
      expect(useOrganizationStore.getState().organizationId).toBe('next-org');
      expect(setQueryDataMock).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe(NEXT_TOKEN);
    });

    it('keeps the newer refresh single-flight when stale work settles', async () => {
      const first = deferred<Response>();
      const second = deferred<Response>();
      fetchMock
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockResolvedValue(mockFetchResponse({ data: { access_token: NEXT_TOKEN } }));
      const older = refreshAccessToken();
      handleCrossTabLogout();
      await establishSession(NEXT_TOKEN);
      const newer = refreshAccessToken();
      first.resolve(mockFetchResponse({ data: { access_token: VALID_TOKEN } }));
      await older;
      const joined = refreshAccessToken();
      second.resolve(mockFetchResponse({ data: { access_token: NEXT_TOKEN } }));
      await Promise.all([newer, joined]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getAccessToken()).toBe(NEXT_TOKEN);
    });

    it('shares startup work and preserves newer login readiness after stale context rejection', async () => {
      useAuthStore.getState().setLoading(true);
      const initial = deferred<MeContext>();
      const next = deferred<MeContext>();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ data: { access_token: VALID_TOKEN } }),
      );
      fetchMeContextMock
        .mockReturnValueOnce(initial.promise)
        .mockReturnValueOnce(next.promise);
      // A returning browser — the boot only asks the server to restore a
      // session when this browser has one to restore.
      localStorage.setItem(`${PRODUCT_NAMESPACE}:session-started-at`, String(Date.now()));
      const bootstrap = startAuthBootstrap();
      expect(startAuthBootstrap()).toBe(bootstrap);
      await vi.waitFor(() => expect(fetchMeContextMock).toHaveBeenCalledOnce());
      const login = establishSession(NEXT_TOKEN);
      initial.reject(new Error('superseded startup'));
      await bootstrap;
      expect(useAuthStore.getState().isLoading).toBe(true);
      expect(getAccessToken()).toBe(NEXT_TOKEN);
      next.resolve(NEXT_CTX);
      await login;
      expect(useAuthStore.getState().user?.id).toBe('next-user');
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
  /*
   * A cold boot whose refresh got no usable answer (503, offline, throttled) says nothing about
   * the session — the refresh cookie may be perfectly alive. The login page's guard waits on the
   * same bootstrap, so a settled failure there used to leave the visitor on the sign-in form with
   * nothing asking again until they reloaded.
   */
  describe('startAuthBootstrap after a boot with no usable answer', () => {
    async function freshService() {
      vi.resetModules();
      const service = await import('./service.ts');
      const { useAuthStore: store } =
        await import('@/shared/store/useAuthStore/index.ts');
      localStorage.setItem(`${PRODUCT_NAMESPACE}:session-started-at`, String(Date.now()));
      return { service, store };
    }

    it('asks again on the next wait when the refresh went unanswered', async () => {
      const { service, store } = await freshService();
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse({}, 503))
        .mockResolvedValueOnce(mockFetchResponse({}, 503))
        .mockResolvedValue(mockFetchResponse({ data: { access_token: VALID_TOKEN } }));
      fetchMeContextMock.mockResolvedValue(SAMPLE_CTX);

      const first = service.startAuthBootstrap();
      await first;
      expect(store.getState().isAuthenticated).toBe(false);

      const second = service.startAuthBootstrap();
      expect(second).not.toBe(first);
      await second;
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('asks again when me/context failed after the refresh', async () => {
      const { service, store } = await freshService();
      // A fresh Response per call: a body can be read once.
      fetchMock.mockImplementation(() =>
        Promise.resolve(mockFetchResponse({ data: { access_token: VALID_TOKEN } })),
      );
      const { HttpError } = await import('@/shared/errors/HttpError.ts');
      fetchMeContextMock
        .mockRejectedValueOnce(
          new HttpError('Service unavailable', 503, '/auth/me/context', 'GET'),
        )
        .mockResolvedValue(SAMPLE_CTX);

      await service.startAuthBootstrap();
      expect(store.getState().isAuthenticated).toBe(false);

      await service.startAuthBootstrap();
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('settles for a refused refresh — the session is gone', async () => {
      const { service } = await freshService();
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: { detail: 'Session expired' } }, 401),
      );

      const first = service.startAuthBootstrap();
      await first;

      expect(service.startAuthBootstrap()).toBe(first);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('a boot the server refuses at its idle limit lands on a login that does not sign back in (E-2)', async () => {
      sessionStorage.clear();
      const { service } = await freshService();
      const autoGoogle = await import('./auto-google-sign-in.ts');
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: { reason: 'idle_timeout', detail: 'Idle' } }, 401),
      );

      await service.startAuthBootstrap();

      expect(autoGoogle.shouldAttemptAutoGoogleSignIn()).toBe(false);
    });
  });

  describe('a refresh clinozy-be refuses (E-2)', () => {
    /** Refuse the next refresh with `reason`, answer the revoke, and hand back the refusal. */
    async function refusedWith(reason: string | undefined) {
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          String(url).includes('/auth/refresh')
            ? mockFetchResponse({ error: { reason, detail: 'Refused' } }, 401)
            : mockFetchResponse({}),
        ),
      );
      setAccessToken(VALID_TOKEN);
      return refreshAccessToken().catch((caught: unknown) => caught);
    }
    const revokes = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/logout')).length;

    beforeEach(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    it.each(['idle_timeout', 'session_expired'])(
      'at %s ends the session deliberately — revoked, and no auto-Google sign-in back',
      async (reason) => {
        const refusal = await refusedWith(reason);

        endRefusedSession(refusal);

        expect(revokes()).toBe(1);
        expect(shouldAttemptAutoGoogleSignIn()).toBe(false);
        expect(getAccessToken()).toBeNull();
        expect(window.location.href).toBe('/login');
      },
    );

    it('for any other reason is a dead session: cleared locally, auto-Google left as it was', async () => {
      const refusal = await refusedWith('session_revoked');

      endRefusedSession(refusal);

      expect(revokes()).toBe(0);
      expect(shouldAttemptAutoGoogleSignIn()).toBe(true);
      expect(getAccessToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('with no reason at all is a dead session too', async () => {
      const refusal = await refusedWith(undefined);

      endRefusedSession(refusal);

      expect(revokes()).toBe(0);
      expect(shouldAttemptAutoGoogleSignIn()).toBe(true);
    });
  });

  describe('startAuthBootstrap on a load that is completing a sign-in', () => {
    // A session hint is present: without the boot's sign-in, this load WOULD refresh.
    async function freshService() {
      vi.resetModules();
      const service = await import('./service.ts');
      const { useAuthStore: store } =
        await import('@/shared/store/useAuthStore/index.ts');
      localStorage.setItem(`${PRODUCT_NAMESPACE}:session-started-at`, String(Date.now()));
      store.setState({ user: null, isAuthenticated: false, isLoading: true });
      return { service, store };
    }

    it('waits for the sign-in instead of refreshing beside it', async () => {
      const { service, store } = await freshService();
      const signIn = deferred<void>();
      service.bootstrapWithSignIn(signIn.promise);

      const boot = service.startAuthBootstrap();
      expect(service.startAuthBootstrap()).toBe(boot);
      signIn.resolve();
      await boot;

      // No `/auth/refresh`: its answer would race the new session's refresh cookie.
      expect(fetchMock).not.toHaveBeenCalled();
      expect(store.getState().isLoading).toBe(false);
    });

    it('never rejects — a failed sign-in leaves a guest, done loading', async () => {
      const { service, store } = await freshService();
      service.bootstrapWithSignIn(Promise.reject(new Error('code already used')));

      await expect(service.startAuthBootstrap()).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(store.getState()).toMatchObject({
        isAuthenticated: false,
        isLoading: false,
      });
    });
  });
});
