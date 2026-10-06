import {
  createMemoryHistory,
  createRouter,
  isRedirect,
  redirect,
} from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requireOrgStatus, requireSuspendedOrgStatus } from '@/app/guards/org-gates.ts';
import { composePageTitle } from '@/lib/routes/page-head.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import { manifest as appointmentManifest } from '@/pages/organization/$organizationSlug/appointments/$appointmentId/appointment-id.manifest.ts';
import { validateAppointmentsSearch } from '@/pages/organization/$organizationSlug/appointments/appointments.search.ts';
import { manifest as appointmentCreateManifest } from '@/pages/organization/$organizationSlug/appointments/create/create.manifest.ts';
import { manifest as leadManifest } from '@/pages/organization/$organizationSlug/leads/$leadId/lead-id.manifest.ts';
import { manifest as leadCreateManifest } from '@/pages/organization/$organizationSlug/leads/create/create.manifest.ts';
import { validateLeadsSearch } from '@/pages/organization/$organizationSlug/leads/leads.search.ts';
import { validatePatientImagesSearch } from '@/pages/organization/$organizationSlug/patients/$patientId/images/images.search.ts';
import { manifest as patientFileManifest } from '@/pages/organization/$organizationSlug/patients/$patientId/patient-id.manifest.ts';
import { validatePatientFileSearch } from '@/pages/organization/$organizationSlug/patients/$patientId/patient-id.search.ts';
import { manifest as suspendedManifest } from '@/pages/organization/$organizationSlug/suspended/suspended.manifest.ts';
import { manifest as taskManifest } from '@/pages/organization/$organizationSlug/tasks/$taskId/task-id.manifest.ts';
import { manifest as taskCreateManifest } from '@/pages/organization/$organizationSlug/tasks/create/create.manifest.ts';
import { validateTasksSearch } from '@/pages/organization/$organizationSlug/tasks/tasks.search.ts';
import { navCandidates } from '@/shared/hooks/useAppNav/index.ts';

import {
  BOOT_PENDING_POLICY,
  createAppRouter,
  IN_APP_PENDING_POLICY,
  preloadBootRoutes,
  preloadSignedInShell,
  router,
} from './routeTree.tsx';

const gatewayExecutor = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const gatewayFromManifest = vi.hoisted(() =>
  vi.fn(
    (_manifest: { path: string }) =>
      gatewayExecutor as (context: unknown) => Promise<void>,
  ),
);
const requireAuth = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const shellLoads = vi.hoisted(() => ({
  auth: vi.fn(),
  public: vi.fn(),
  organization: vi.fn(),
  payments: vi.fn(),
  invoices: vi.fn(),
  emptyHome: vi.fn(),
  login: vi.fn(),
}));
const clinicHomeRoute = vi.hoisted(() => vi.fn());
const notifyInfo = vi.hoisted(() => vi.fn());
vi.mock('@/shared/layouts/AuthLayout/index.ts', () => {
  shellLoads.auth();
  return { AuthLayout: () => null };
});
vi.mock('@/shared/layouts/PublicLayout/index.ts', () => {
  shellLoads.public();
  return { PublicLayout: () => null };
});
// The sign-in side a guest's boot warms: the auth layout (above) and the login island.
vi.mock('@/pages/login/login.route.tsx', () => {
  shellLoads.login();
  return { Component: () => null };
});
// The islands the signed-in shells and the invoices host render inside their own
// components — the router's chunk preloader cannot see them, so their loaders must.
vi.mock('@/pages/organization/$organizationSlug/organization-slug.route.tsx', () => {
  shellLoads.organization();
  return { Component: () => null };
});
vi.mock(
  '@/pages/organization/$organizationSlug/components/ClinicHomeEmpty/index.ts',
  () => {
    shellLoads.emptyHome();
    return { ClinicHomeEmpty: () => null };
  },
);
vi.mock('@/shared/clinic/clinic-home.ts', () => ({ clinicHomeRoute }));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notify: { info: notifyInfo },
}));
vi.mock('@/pages/organization/$organizationSlug/payments/payments.route.tsx', () => {
  shellLoads.payments();
  return { Component: () => null };
});
vi.mock('@/pages/organization/$organizationSlug/invoices/invoices.route.tsx', () => {
  shellLoads.invoices();
  return { Component: () => null };
});

vi.mock('@/core/security/gateway.ts', () => ({ gatewayFromManifest }));
const { visitRedirectMock } = vi.hoisted(() => ({ visitRedirectMock: vi.fn() }));
vi.mock('@/shared/clinic/visit-redirect.ts', () => ({
  visitRedirect: visitRedirectMock,
}));
vi.mock('@/core/security/gate-context.ts', () => ({
  toGateContext: vi.fn(() => ({ kind: 'gate-context-sentinel' })),
}));
vi.mock('@/core/rbac/guards.ts', () => ({
  requireAuth,
  redirectIfAuthenticated: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/app/guards/org-gates.ts', () => ({
  requireOrgStatus: vi.fn(),
  requireProvisionedWorkspace: vi.fn().mockResolvedValue(undefined),
  requireSuspendedOrgStatus: vi.fn(),
  requireTeamDeployment: vi.fn(),
  resolveActiveOrg: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/app/guards/route-guards.ts', () => ({
  requireOnboardingWorkspace: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/tenancy/organization-resolver.ts', () => ({
  resolveRootRedirect: vi.fn().mockResolvedValue('/organization'),
}));

type BeforeLoad = (context: {
  location: { href: string };
  params: Record<string, string>;
  preload: boolean;
}) => Promise<void> | void;

function beforeLoadOf(routeId: string): BeforeLoad {
  const route = (
    router.routesById as Record<string, { options: { beforeLoad?: unknown } }>
  )[routeId];
  expect(route, `route ${routeId} must be registered`).toBeDefined();
  expect(
    route?.options.beforeLoad,
    `route ${routeId} must have beforeLoad`,
  ).toBeDefined();
  return route?.options.beforeLoad as BeforeLoad;
}

/**
 * A dialog route keeps its search as the URL has it — typed for the links that
 * open it; the page or sheet that reads it parses it with the room's validator,
 * which loads with the room rather than the entry chunk (L-54).
 */
function expectKeptSearch(route: { options: { validateSearch?: unknown } } | undefined) {
  const raw = { name: '  Rhea  ', from: 'nowhere', junk: 1 };
  const validate = route?.options.validateSearch as
    ((search: object) => object) | undefined;
  expect(validate?.(raw)).toBe(raw);
}

/** The app's real route tree in a memory router, at `url`. */
const memoryRouterAt = (url: string) =>
  createRouter({
    routeTree: router.routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
  });

const gateArgs = (preload: boolean) => ({
  location: { href: '/organization/acme/suspended' },
  params: { organizationSlug: 'acme' },
  preload,
});

/**
 * Guards the router's performance/correctness contract:
 * - intent preloading is what makes lazy island chunks fetch on hover;
 * - zero preload staleness is what forces the side-effectful guard chain
 *   (org context sync, permission refetch) to re-run on real navigation
 *   instead of being satisfied by a hover preload.
 */
describe('router configuration', () => {
  // An island rendered inside a route's own component is invisible to the router's
  // chunk preloader. Unwarmed, `lazyRouteComponent` suspends through `use()` on its
  // first render, and React warns that it "did not call use() when it finished" —
  // every cold entry into a clinic did. So the route's loader warms it.
  it.each([
    ['auth-shell', ['auth']],
    ['public-shell', ['public']],
    ['/organization/$organizationSlug', ['organization']],
    ['/organization/$organizationSlug/invoices', ['payments', 'invoices']],
  ] as const)('preloads nested %s content through its route loader', async (id, keys) => {
    const route = Object.values(router.routesById).find((item) => item.id.endsWith(id));
    const loader = route?.options.loader as (() => Promise<void> | undefined) | undefined;
    expect(loader).toBeTypeOf('function');
    for (const key of keys) expect(shellLoads[key]).not.toHaveBeenCalled();
    await loader?.();
    for (const key of keys) expect(shellLoads[key]).toHaveBeenCalledOnce();
    // TanStack removes the preload method after the component is cached.
    await loader?.();
    for (const key of keys) expect(shellLoads[key]).toHaveBeenCalledOnce();
  });

  it('marks the URL-driven dialog routes — and no page — so the page holds still under them', () => {
    const SLUG = '/organization/$organizationSlug';
    const dialogs = (
      Object.values(router.routesById) as unknown as {
        id: string;
        options: { staticData?: { dialog?: true } };
      }[]
    )
      .filter((route) => route.options.staticData?.dialog === true)
      .map((route) => route.id);
    // Every null-rendering dialog island (D24): drawers, viewers, previews.
    expect(dialogs).toHaveLength(61);
    expect(dialogs).toEqual(
      expect.arrayContaining(
        [
          '/leads/$leadId',
          '/leads/create',
          '/tasks/$taskId',
          '/patients/$patientId/edit',
          '/patients/$patientId/reviews/create',
          '/patients/$patientId/images/$imageId',
          '/patients/$patientId/treatments/create',
          '/invoices/$invoiceId/edit',
          '/medical/sales/$saleId/return',
          '/stock/items/check',
        ].map((path) => `${SLUG}${path}`),
      ),
    );
    for (const page of [
      '/leads',
      '/today',
      '/invoices',
      '/patients/$patientId',
      '/patients/$patientId/timeline',
      '/medical/sales',
      '/payments/pending',
    ]) {
      expect(dialogs).not.toContain(`${SLUG}${page}`);
    }
  });

  it('preloads route chunks on intent', () => {
    expect(router.options.defaultPreload).toBe('intent');
  });

  it('treats preloaded matches as immediately stale (guards re-run on navigation)', () => {
    expect(router.options.defaultPreloadStaleTime).toBe(0);
  });

  it('has a pending component for suspended lazy islands', () => {
    expect(router.options.defaultPendingComponent).toBeDefined();
  });

  describe('pending policy — boot, then in-app (X-6)', () => {
    type RouteOptions = {
      id: string;
      options: { pendingMs?: number; pendingMinMs?: number; loader?: unknown };
    };
    const allRoutes = Object.values(router.routesById) as unknown as RouteOptions[];

    /** The event the router emits for the navigation that actually commits. */
    function resolveFirstNavigation(target: ReturnType<typeof createAppRouter>) {
      target.emit({ type: 'onResolved' } as Parameters<typeof target.emit>[0]);
    }

    it('boots showing the pending component at once — there is no screen to keep', () => {
      // The pending component is FullPageSpinner, which renders nothing on boot
      // but HOLDS the HTML splash. Deferring it 3s let the splash fade to a blank
      // page while a guard awaited the network.
      const fresh = createAppRouter();
      expect(fresh.options.defaultPendingMs).toBe(0);
      expect(fresh.options.defaultPendingComponent).toBeDefined();
    });

    it('does not hold the boot for the router’s built-in 500ms pending minimum', () => {
      // Regression: `defaultPendingMinMs` is 500 unless overridden, counted from
      // the moment the fallback renders. On boot the "spinner" is the splash the
      // user is already looking at, so there is nothing to flash — it just parked
      // every cold load for half a second (refresh answered at ~130ms, the login
      // screen's chunks not even requested until ~650ms).
      const fresh = createAppRouter();
      expect(fresh.options.defaultPendingMinMs).toBe(0);
      expect(BOOT_PENDING_POLICY).toEqual({
        defaultPendingMs: 0,
        defaultPendingMinMs: 0,
      });
    });

    it('settles into the in-app policy once the first navigation resolves', () => {
      // Now there IS a current screen: keep it for up to 3s while guards run, and
      // if the spinner does have to show, keep it long enough not to flash.
      const fresh = createAppRouter();

      resolveFirstNavigation(fresh);

      expect(fresh.options.defaultPendingMs).toBe(3000);
      expect(fresh.options.defaultPendingMinMs).toBe(500);
      expect(IN_APP_PENDING_POLICY).toEqual({
        defaultPendingMs: 3000,
        defaultPendingMinMs: 500,
      });
    });

    it('keeps every other router option across that switch', () => {
      const fresh = createAppRouter();
      const before = { ...fresh.options };

      resolveFirstNavigation(fresh);

      expect(fresh.options.routeTree).toBe(before.routeTree);
      expect(fresh.options.defaultPreload).toBe('intent');
      expect(fresh.options.defaultPreloadStaleTime).toBe(0);
      expect(fresh.options.defaultPendingComponent).toBe(before.defaultPendingComponent);
    });

    it('switches once — later navigations do not touch the options again', () => {
      const fresh = createAppRouter();
      const update = vi.spyOn(fresh, 'update');

      resolveFirstNavigation(fresh);
      resolveFirstNavigation(fresh);
      resolveFirstNavigation(fresh);

      expect(update).toHaveBeenCalledOnce();
    });

    it('no route opts out: the policy is the router’s, so every cold URL is covered', () => {
      // It used to be opted into by four routes (`/`, the auth shell,
      // `/onboarding`, `/organization`) — but a cold visit lands just as often on
      // a bookmarked room or an emailed invite, which got the blank page.
      const overriding = allRoutes.filter(
        (route) =>
          route.options.pendingMs !== undefined ||
          route.options.pendingMinMs !== undefined,
      );
      expect(overriding.map((route) => route.id)).toEqual([]);
    });
  });

  describe('chunk warm-up', () => {
    beforeEach(() => {
      shellLoads.login.mockClear();
    });

    // The login island is fetched once per module instance (`lazyRouteComponent`
    // drops its preload once the chunk is cached), so the two "never the sign-in
    // side" checks run before the guest warm-up fetches it.
    it('warms the app side for a likely signed-in user, not the sign-in side', async () => {
      preloadBootRoutes({ likelySignedIn: true });
      // Give a wrongly-started sign-in warm-up the same tick to show itself.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(shellLoads.login).not.toHaveBeenCalled();
    });

    // Called on INTENT (an email submitted, an OAuth redirect started), not only
    // at boot — so it has to settle cleanly on its own rather than only as a
    // fire-and-forget branch of `preloadBootRoutes`.
    it('resolves when the signed-in shell is warmed directly', async () => {
      await expect(preloadSignedInShell()).resolves.toBeUndefined();

      // Same side as the signed-in boot hint: never the sign-in island.
      expect(shellLoads.login).not.toHaveBeenCalled();
    });

    it('warms the sign-in side for a likely guest, in parallel with the auth bootstrap', async () => {
      preloadBootRoutes({ likelySignedIn: false });

      await vi.waitFor(() => expect(shellLoads.login).toHaveBeenCalledOnce());
    });
  });

  it('draws every route whose manifest asks for the nav (useAppNav reads staticData)', () => {
    const navRoutes = Object.values(router.routesById).flatMap((route) => {
      const manifest = route.options.staticData?.manifest;
      return manifest?.nav ? [{ fullPath: route.fullPath, manifest }] : [];
    });
    expect(navRoutes.map((route) => route.fullPath)).toContain(
      '/organization/$organizationSlug/today',
    );
    for (const route of navRoutes) {
      expect(navCandidates([route], () => true)).toHaveLength(1);
    }
  });

  it('wires an error component on every routed island (root handles the rest)', () => {
    const routes = Object.values(router.routesById).filter(
      (route) => route.id !== '__root__' && route.id !== '/',
    );
    for (const route of routes) {
      expect(route.options.errorComponent, `route ${route.id}`).toBeDefined();
    }
  });
});

describe('guard wiring in beforeLoad', () => {
  beforeEach(() => {
    gatewayExecutor.mockClear();
    gatewayFromManifest.mockClear();
    requireAuth.mockClear();
    vi.mocked(requireOrgStatus).mockClear();
    vi.mocked(requireSuspendedOrgStatus).mockClear();
  });

  it('suspended leaf runs the standard gateway on navigation', async () => {
    await beforeLoadOf('/organization/$organizationSlug/suspended')(gateArgs(false));
    expect(gatewayFromManifest).toHaveBeenCalledWith(suspendedManifest);
    expect(gatewayExecutor).toHaveBeenCalledWith({ kind: 'gate-context-sentinel' });
  });

  it('suspended leaf runs the INVERSE status guard, never requireOrgStatus', async () => {
    // The leaf is exempt from `requireOrgStatus` so a suspended organization can
    // render without looping — but exempt is not unguarded: the inverse guard
    // sends an organization that is NOT suspended back to its home.
    await beforeLoadOf('/organization/$organizationSlug/suspended')(gateArgs(false));
    expect(requireSuspendedOrgStatus).toHaveBeenCalledTimes(1);
    expect(requireOrgStatus).not.toHaveBeenCalled();
  });

  it('a room runs requireOrgStatus, never the inverse', async () => {
    await beforeLoadOf('/organization/$organizationSlug/today')(gateArgs(false));
    expect(requireOrgStatus).toHaveBeenCalledTimes(1);
    expect(requireSuspendedOrgStatus).not.toHaveBeenCalled();
  });

  it('suspended leaf short-circuits on preload (no gateway side effects)', async () => {
    await beforeLoadOf('/organization/$organizationSlug/suspended')(gateArgs(true));
    expect(gatewayFromManifest).not.toHaveBeenCalled();
    expect(requireSuspendedOrgStatus).not.toHaveBeenCalled();
  });

  it('picker and org shell bail out before requireAuth on preload', async () => {
    await beforeLoadOf('/organization')(gateArgs(true));
    await beforeLoadOf('/organization/$organizationSlug')(gateArgs(true));
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it('picker and org shell run requireAuth on real navigation', async () => {
    await beforeLoadOf('/organization')(gateArgs(false));
    await beforeLoadOf('/organization/$organizationSlug')(gateArgs(false));
    expect(requireAuth).toHaveBeenCalledTimes(2);
  });

  // Regression (INV-4): the signed-out check used to live in a passive effect
  // inside the page, so the "Joining…" card painted for a frame and then
  // vanished — for the COMMON case, since an invite recipient is usually not
  // signed in yet. Deciding it in beforeLoad costs zero frames, and passing
  // location.href carries the invite token back through login.
  it('accept-invite requires auth before it renders, carrying the invite link', async () => {
    const href = '/accept-invite/inv_abc?token=tok_123';
    await beforeLoadOf('/public-shell/accept-invite/$invitationId')({
      location: { href },
      params: { invitationId: 'inv_abc' },
      preload: false,
    });
    expect(requireAuth).toHaveBeenCalledWith(href);
  });
});

/** What a `beforeLoad` threw — a redirect or a not-found — or `undefined` when it returned. */
async function thrownBy(run: () => Promise<void> | void): Promise<unknown> {
  try {
    await run();
    return undefined;
  } catch (error: unknown) {
    return error;
  }
}

describe('the org home replaces the dashboard as every landing (L-63)', () => {
  const HOME = '/organization/$organizationSlug/';
  const UNKNOWN = '/organization/$organizationSlug/$';
  const args = {
    location: { href: '/organization/acme' },
    params: { organizationSlug: 'acme' },
    preload: false,
  };
  const leads = {
    to: '/organization/$organizationSlug/leads',
    params: { organizationSlug: 'acme' },
  };

  beforeEach(() => {
    clinicHomeRoute.mockReset();
    notifyInfo.mockClear();
    vi.mocked(requireOrgStatus).mockReset();
  });

  it('sends the member on to their role home', async () => {
    clinicHomeRoute.mockResolvedValue(leads);
    const thrown = await thrownBy(() => beforeLoadOf(HOME)(args));
    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: leads });
    expect(clinicHomeRoute).toHaveBeenCalledWith('acme');
  });

  it('renders the empty home in place when no room is open — no redirect, so no loop', async () => {
    clinicHomeRoute.mockResolvedValue(null);
    expect(await thrownBy(() => beforeLoadOf(HOME)(args))).toBeUndefined();
    expect(requireOrgStatus).toHaveBeenCalledOnce();

    const home = (
      router.routesById as unknown as Record<
        string,
        { options: { component?: { preload?: () => Promise<void> | undefined } } }
      >
    )[HOME];
    await home?.options.component?.preload?.();
    expect(shellLoads.emptyHome).toHaveBeenCalledOnce();
  });

  it('gives a suspended clinic its blocked state, never the empty home', async () => {
    const suspended = redirect({
      to: '/organization/$organizationSlug/suspended',
      params: { organizationSlug: 'acme' },
    });
    vi.mocked(requireOrgStatus).mockImplementation(() => {
      throw suspended;
    });
    expect(await thrownBy(() => beforeLoadOf(HOME)(args))).toBe(suspended);
    expect(clinicHomeRoute).not.toHaveBeenCalled();
  });

  it('resolves nothing on a hover preload', async () => {
    await beforeLoadOf(HOME)({ ...args, preload: true });
    expect(clinicHomeRoute).not.toHaveBeenCalled();
    expect(requireOrgStatus).not.toHaveBeenCalled();
  });

  it('an unknown in-org path says so and lands on the role home', async () => {
    clinicHomeRoute.mockResolvedValue(leads);
    const thrown = await thrownBy(() => beforeLoadOf(UNKNOWN)(args));
    expect(notifyInfo).toHaveBeenCalledOnce();
    expect(thrown).toMatchObject({ options: leads });
  });

  it('with no room open, an unknown in-org path lands on the empty home', async () => {
    clinicHomeRoute.mockResolvedValue(null);
    const thrown = await thrownBy(() => beforeLoadOf(UNKNOWN)(args));
    expect(thrown).toMatchObject({
      options: {
        to: '/organization/$organizationSlug',
        params: { organizationSlug: 'acme' },
      },
    });
  });

  it('keeps no route at the old team dashboard — its URL is an unknown in-org path', () => {
    const ids = Object.keys(router.routesById);
    expect(ids).not.toContain('/organization/$organizationSlug/dashboard');
    expect(ids).not.toContain('personal-app');
  });

  it('resolves the retired /dashboard as / does', async () => {
    const thrown = await thrownBy(() => beforeLoadOf('/dashboard')(args));
    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: { to: '/' } });
    expect(
      await thrownBy(() => beforeLoadOf('/dashboard')({ ...args, preload: true })),
    ).toBeUndefined();
  });
});

describe('the Leads dialog routes (KICKOFF §4, D24, S:22–25)', () => {
  const LEADS = '/organization/$organizationSlug/leads';
  type LeadRoute = {
    options: {
      validateSearch?: unknown;
      staticData?: { manifest?: unknown };
      beforeLoad?: (context: Record<string, unknown>) => unknown;
      loader?: () => Promise<unknown>;
    };
  };
  const routeOf = (id: string) =>
    (router.routesById as unknown as Record<string, LeadRoute | undefined>)[id];

  beforeEach(() => {
    gatewayExecutor.mockClear();
    gatewayFromManifest.mockClear();
    vi.mocked(requireOrgStatus).mockClear();
  });

  it('registers New lead, the lead drawer and the edit redirect under the list', () => {
    const children = Object.keys(router.routesById)
      .filter((id) => id.startsWith(`${LEADS}/`))
      .sort();
    expect(children).toEqual([
      `${LEADS}/$leadId`,
      `${LEADS}/$leadId/edit`,
      `${LEADS}/create`,
    ]);
  });

  it('validates the list’s search on the list, and keeps New lead’s prefill for the list to parse', () => {
    expect(routeOf(LEADS)?.options.validateSearch).toBe(validateLeadsSearch);
    expectKeptSearch(routeOf(`${LEADS}/create`));
  });

  it.each([
    [`${LEADS}/create`, leadCreateManifest],
    [`${LEADS}/$leadId`, leadManifest],
  ] as const)(
    '%s runs the room gateway on its own manifest, then the status guard',
    async (id, manifest) => {
      await beforeLoadOf(id)({
        location: { href: '/organization/acme/leads/create' },
        params: { organizationSlug: 'acme', leadId: 'L1' },
        preload: false,
      });
      expect(gatewayFromManifest).toHaveBeenCalledWith(manifest);
      expect(gatewayExecutor).toHaveBeenCalledWith({ kind: 'gate-context-sentinel' });
      expect(requireOrgStatus).toHaveBeenCalledTimes(1);
      // The manifest rides the dialog-route registry, not the entry chunk.
      expect(routeOf(id)?.options.staticData?.manifest).toBeUndefined();
      await expect(routeOf(id)?.options.loader?.()).resolves.toBe(manifest);
    },
  );

  it('redirects the edit URL to the lead drawer, keeping the list’s search (S:25)', () => {
    const thrown = (() => {
      try {
        routeOf(`${LEADS}/$leadId/edit`)?.options.beforeLoad?.({
          params: { organizationSlug: 'acme', leadId: 'L1' },
          search: { view: 'all' },
          preload: false,
        });
      } catch (caught) {
        return caught;
      }
      return null;
    })();
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: unknown }).options).toMatchObject({
      to: `${LEADS}/$leadId`,
      params: { organizationSlug: 'acme', leadId: 'L1' },
      search: { view: 'all' },
    });
  });

  it('lands a typed edit URL on the drawer URL through the real tree', async () => {
    const memoryRouter = createRouter({
      routeTree: router.routeTree,
      history: createMemoryHistory({
        initialEntries: ['/organization/acme/leads/L1/edit?view=all&status=new'],
      }),
    });
    await memoryRouter.load();
    await vi.waitFor(() =>
      expect(memoryRouter.state.location.pathname).toBe('/organization/acme/leads/L1'),
    );
    expect(memoryRouter.state.location.search).toEqual({ view: 'all', status: 'new' });
    expect(memoryRouter.state.matches.at(-1)?.routeId).toBe(`${LEADS}/$leadId`);
  });
});

describe('the Appointments dialog routes (KICKOFF §4, D24, D27, S:26–29)', () => {
  const APPOINTMENTS = '/organization/$organizationSlug/appointments';
  type AppointmentRoute = {
    options: {
      validateSearch?: unknown;
      staticData?: { manifest?: unknown };
      beforeLoad?: (context: Record<string, unknown>) => unknown;
      loader?: () => Promise<unknown>;
    };
  };
  const routeOf = (id: string) =>
    (router.routesById as unknown as Record<string, AppointmentRoute | undefined>)[id];

  beforeEach(() => {
    gatewayExecutor.mockClear();
    gatewayFromManifest.mockClear();
    vi.mocked(requireOrgStatus).mockClear();
  });

  it('registers New appointment, the drawer and the edit redirect under the page', () => {
    const children = Object.keys(router.routesById)
      .filter((id) => id.startsWith(`${APPOINTMENTS}/`))
      .sort();
    expect(children).toEqual([
      `${APPOINTMENTS}/$appointmentId`,
      `${APPOINTMENTS}/$appointmentId/edit`,
      `${APPOINTMENTS}/create`,
    ]);
  });

  it('validates the page’s view and filters on the page, and keeps each drawer’s params for the page to parse', () => {
    expect(routeOf(APPOINTMENTS)?.options.validateSearch).toBe(
      validateAppointmentsSearch,
    );
    expectKeptSearch(routeOf(`${APPOINTMENTS}/create`));
    expectKeptSearch(routeOf(`${APPOINTMENTS}/$appointmentId`));
  });

  it.each([
    [`${APPOINTMENTS}/create`, appointmentCreateManifest],
    [`${APPOINTMENTS}/$appointmentId`, appointmentManifest],
  ] as const)(
    '%s runs the room gateway on its own manifest, then the status guard',
    async (id, manifest) => {
      await beforeLoadOf(id)({
        location: { href: '/organization/acme/appointments/create' },
        params: { organizationSlug: 'acme', appointmentId: 'A1' },
        preload: false,
      });
      expect(gatewayFromManifest).toHaveBeenCalledWith(manifest);
      expect(gatewayExecutor).toHaveBeenCalledWith({ kind: 'gate-context-sentinel' });
      expect(requireOrgStatus).toHaveBeenCalledTimes(1);
      // The manifest rides the dialog-route registry, not the entry chunk.
      expect(routeOf(id)?.options.staticData?.manifest).toBeUndefined();
      await expect(routeOf(id)?.options.loader?.()).resolves.toBe(manifest);
    },
  );

  it('hands New appointment opened from another room over to that room, masked as its own URL (A-P1)', async () => {
    const href = '/organization/acme/appointments/create?who=W1&from=today';
    const location = {
      pathname: '/organization/acme/appointments/create',
      search: { who: 'W1', from: 'today' },
      searchStr: '?who=W1&from=today',
      href,
    };
    const thrown = await Promise.resolve(
      beforeLoadOf(`${APPOINTMENTS}/create`)({
        location,
        params: { organizationSlug: 'acme' },
        preload: false,
      }),
    ).then(
      () => null,
      (caught: unknown) => caught,
    );
    // The drawer's own gate ran first.
    expect(gatewayFromManifest).toHaveBeenCalledWith(appointmentCreateManifest);
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: unknown }).options).toMatchObject({
      href: `/organization/acme/today?dialog=${encodeURIComponent('appointments/create?who=W1&from=today')}`,
      mask: { href },
      replace: true,
      resetScroll: false,
    });
  });

  it('keeps a drawer on its own route without another room to keep, and on a preload', async () => {
    const at = (search: Record<string, unknown>) => ({
      pathname: '/organization/acme/appointments/create',
      search,
      href: '/organization/acme/appointments/create',
    });
    for (const search of [{}, { from: 'appointments' }, { from: 'users' }]) {
      await expect(
        beforeLoadOf(`${APPOINTMENTS}/create`)({
          location: at(search),
          params: { organizationSlug: 'acme' },
          preload: false,
        }),
      ).resolves.toBeUndefined();
    }
    await expect(
      beforeLoadOf(`${APPOINTMENTS}/create`)({
        location: at({ from: 'today' }),
        params: { organizationSlug: 'acme' },
        preload: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('redirects the edit URL to the drawer, keeping the search (S:29)', () => {
    const thrown = (() => {
      try {
        routeOf(`${APPOINTMENTS}/$appointmentId/edit`)?.options.beforeLoad?.({
          params: { organizationSlug: 'acme', appointmentId: 'A1' },
          search: { view: 'day', mode: 'reschedule' },
          preload: false,
        });
      } catch (caught) {
        return caught;
      }
      return null;
    })();
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: unknown }).options).toMatchObject({
      to: `${APPOINTMENTS}/$appointmentId`,
      params: { organizationSlug: 'acme', appointmentId: 'A1' },
      search: { view: 'day', mode: 'reschedule' },
    });
  });

  it('lands a typed edit URL on the drawer URL through the real tree', async () => {
    const memoryRouter = createRouter({
      routeTree: router.routeTree,
      history: createMemoryHistory({
        initialEntries: ['/organization/acme/appointments/A1/edit?view=week&status=all'],
      }),
    });
    await memoryRouter.load();
    await vi.waitFor(() =>
      expect(memoryRouter.state.location.pathname).toBe(
        '/organization/acme/appointments/A1',
      ),
    );
    expect(memoryRouter.state.location.search).toEqual({ view: 'week', status: 'all' });
    expect(memoryRouter.state.matches.at(-1)?.routeId).toBe(
      `${APPOINTMENTS}/$appointmentId`,
    );
  });
});

describe('the Tasks dialog routes (KICKOFF §4, D24, S:95–97)', () => {
  const TASKS = '/organization/$organizationSlug/tasks';
  type TaskRoute = {
    options: {
      validateSearch?: unknown;
      staticData?: { manifest?: unknown };
      loader?: () => Promise<unknown>;
    };
  };
  const routeOf = (id: string) =>
    (router.routesById as unknown as Record<string, TaskRoute | undefined>)[id];

  beforeEach(() => {
    gatewayExecutor.mockClear();
    gatewayFromManifest.mockClear();
    vi.mocked(requireOrgStatus).mockClear();
  });

  it('registers New task and the task drawer under the list, which validates its own search', () => {
    expect(
      Object.keys(router.routesById).filter((id) => id.startsWith(`${TASKS}/`)),
    ).toEqual([`${TASKS}/create`, `${TASKS}/$taskId`]);
    expect(routeOf(TASKS)?.options.validateSearch).toBe(validateTasksSearch);
    expectKeptSearch(routeOf(`${TASKS}/create`));
  });

  it('gates New task on its own manifest, then the status guard', async () => {
    await beforeLoadOf(`${TASKS}/create`)({
      location: { href: '/organization/acme/tasks/create' },
      params: { organizationSlug: 'acme' },
      preload: false,
    });
    expect(gatewayFromManifest).toHaveBeenCalledWith(taskCreateManifest);
    expect(requireOrgStatus).toHaveBeenCalledTimes(1);
    expect(routeOf(`${TASKS}/create`)?.options.staticData?.manifest).toBeUndefined();
    await expect(routeOf(`${TASKS}/create`)?.options.loader?.()).resolves.toBe(
      taskCreateManifest,
    );
  });

  it('runs the room gateway on the drawer’s own manifest, then the status guard', async () => {
    await beforeLoadOf(`${TASKS}/$taskId`)({
      location: { href: '/organization/acme/tasks/T1' },
      params: { organizationSlug: 'acme', taskId: 'T1' },
      preload: false,
    });
    expect(gatewayFromManifest).toHaveBeenCalledWith(taskManifest);
    expect(gatewayExecutor).toHaveBeenCalledWith({ kind: 'gate-context-sentinel' });
    expect(requireOrgStatus).toHaveBeenCalledTimes(1);
    expect(routeOf(`${TASKS}/$taskId`)?.options.staticData?.manifest).toBeUndefined();
    await expect(routeOf(`${TASKS}/$taskId`)?.options.loader?.()).resolves.toBe(
      taskManifest,
    );
  });
});

describe('an old Visit sheet link (L-64: the sheet is gone)', () => {
  const VISIT = '/organization/$organizationSlug/visits/$visitId';

  it('is a pure redirect under the org shell — no page, no dialog', () => {
    expect(
      Object.keys(router.routesById).filter((id) =>
        id.startsWith('/organization/$organizationSlug/visits'),
      ),
    ).toEqual([VISIT]);
    const route = (
      router.routesById as unknown as Record<
        string,
        { options: { staticData?: unknown; validateSearch?: unknown } }
      >
    )[VISIT];
    expect(route?.options.staticData).toBeUndefined();
    expect(route?.options.validateSearch).toBeUndefined();
  });

  it('redirects to where the resolver sends the visit — and does nothing on a preload', async () => {
    visitRedirectMock.mockResolvedValueOnce({
      to: '/organization/$organizationSlug/patients/$patientId/timeline',
      params: { organizationSlug: 'acme', patientId: 'P1' },
      search: { visit: 'open', from: 'today' },
      replace: true,
    });
    const run = beforeLoadOf(VISIT);
    await expect(
      run({
        location: { href: '/organization/acme/visits/V1' },
        params: { organizationSlug: 'acme', visitId: 'V1' },
        preload: true,
      }),
    ).resolves.toBeUndefined();
    expect(visitRedirectMock).not.toHaveBeenCalled();
    const thrown = await Promise.resolve(
      run({
        location: { href: '/organization/acme/visits/V1?tab=consult' },
        params: { organizationSlug: 'acme', visitId: 'V1' },
        preload: false,
      }),
    ).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(visitRedirectMock).toHaveBeenCalledWith('acme', 'V1');
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: unknown }).options).toMatchObject({
      to: '/organization/$organizationSlug/patients/$patientId/timeline',
      params: { organizationSlug: 'acme', patientId: 'P1' },
      search: { visit: 'open', from: 'today' },
    });
  });
});

describe('the patient file routes (KICKOFF §6.6, §4; S:33–34)', () => {
  const FILE = '/organization/$organizationSlug/patients/$patientId';
  type FileRoute = {
    options: {
      validateSearch?: unknown;
      staticData?: { manifest?: unknown };
      beforeLoad?: (context: Record<string, unknown>) => unknown;
      errorComponent?: unknown;
    };
  };
  const routeOf = (id: string) =>
    (router.routesById as unknown as Record<string, FileRoute | undefined>)[id];

  beforeEach(() => {
    gatewayExecutor.mockClear();
    gatewayFromManifest.mockClear();
    vi.mocked(requireOrgStatus).mockClear();
  });

  it('registers the eleven sections, their record dialogs, the file-level drawers, the index and the unknown section', () => {
    const children = Object.keys(router.routesById)
      .filter((id) => id.startsWith(`${FILE}/`))
      .sort();
    expect(children).toEqual(
      [
        '$',
        // The drawers over the whole file (S:34, 44–47): Edit patient, check-ins, reviews.
        'edit',
        'check-ins/create',
        'check-ins/$checkInId/edit',
        'reviews/create',
        'reviews/$reviewId/edit',
        'images',
        'images/$imageId',
        'images/$imageId/edit',
        'invoices',
        'notes',
        'overview',
        'packages',
        'payments',
        'prescriptions',
        // The record dialogs (S:35–39, 42–43): each renders nothing over its section.
        'prescriptions/create',
        'prescriptions/$prescriptionId',
        'prescriptions/$prescriptionId/edit',
        'reports',
        'reports/create',
        'reports/$reportId',
        'timeline',
        'treatments',
        'treatments/create',
        'treatments/$treatmentId/edit',
        'visits',
        '',
      ]
        .map((segment) => `${FILE}/${segment}`)
        .sort(),
    );
  });

  it('validates `activity` on the file and the album and filter on Photos, and keeps the drawers’ params for them to parse', () => {
    expect(routeOf(FILE)?.options.validateSearch).toBe(validatePatientFileSearch);
    for (const drawer of [
      'edit',
      'check-ins/create',
      'check-ins/$checkInId/edit',
      'reviews/create',
      'reviews/$reviewId/edit',
      'prescriptions/create',
    ]) {
      expectKeptSearch(routeOf(`${FILE}/${drawer}`));
    }
    expect(routeOf(`${FILE}/images`)?.options.validateSearch).toBe(
      validatePatientImagesSearch,
    );
  });

  it('runs the room gateway on the file’s manifest, then the status guard', async () => {
    await beforeLoadOf(FILE)({
      location: { href: '/organization/acme/patients/P1/visits' },
      params: { organizationSlug: 'acme', patientId: 'P1' },
      preload: false,
    });
    expect(gatewayFromManifest).toHaveBeenCalledWith(patientFileManifest);
    expect(gatewayExecutor).toHaveBeenCalledWith({ kind: 'gate-context-sentinel' });
    expect(requireOrgStatus).toHaveBeenCalledTimes(1);
    expect(routeOf(FILE)?.options.staticData?.manifest).toBe(patientFileManifest);
  });

  it('opens the Overview from the bare URL, keeping the Patients row’s `activity`', async () => {
    const memoryRouter = memoryRouterAt('/organization/acme/patients/P1?activity=open');
    await memoryRouter.load();
    await vi.waitFor(() =>
      expect(memoryRouter.state.location.pathname).toBe(
        '/organization/acme/patients/P1/timeline',
      ),
    );
    expect(memoryRouter.state.location.search).toEqual({ activity: 'open' });
    expect(memoryRouter.state.matches.at(-1)?.routeId).toBe(`${FILE}/timeline`);
  });

  it('sends an unknown section to the Overview', async () => {
    const memoryRouter = memoryRouterAt('/organization/acme/patients/P1/secret/deeper');
    await memoryRouter.load();
    await vi.waitFor(() =>
      expect(memoryRouter.state.location.pathname).toBe(
        '/organization/acme/patients/P1/timeline',
      ),
    );
  });
});

describe('the dialog routes’ manifests load with the dialog-route registry (D24, L-54)', () => {
  type DialogRoute = {
    id: string;
    fullPath: string;
    options: {
      staticData?: Record<string, unknown>;
      loader?: () => Promise<PageManifest>;
      head?: (context: { loaderData?: PageManifest }) => unknown;
      beforeLoad?: (context: Record<string, unknown>) => Promise<void> | void;
      validateSearch?: unknown;
    };
  };
  const dialogRoutes = (
    Object.values(router.routesById) as unknown as DialogRoute[]
  ).filter((route) => route.options.staticData?.dialog === true);
  // Every drawer, viewer and preview with a manifest; the patient file's
  // dialogs inherit the file's gate and carry no manifest.
  const manifestBacked = dialogRoutes.filter((route) => route.options.loader);
  const gateArgsFor = (preload: boolean) => ({
    location: { href: '/organization/acme/x' },
    params: { organizationSlug: 'acme' },
    preload,
  });

  beforeEach(() => {
    gatewayExecutor.mockClear();
    gatewayFromManifest.mockClear();
    vi.mocked(requireOrgStatus).mockClear();
  });

  it('keeps every dialog manifest out of the entry chunk: static data only says it is a dialog', () => {
    expect(manifestBacked).toHaveLength(47);
    for (const route of dialogRoutes) {
      expect(route.options.staticData, route.id).toEqual({ dialog: true });
    }
  });

  it('parses no dialog’s search in the entry chunk: every dialog route shares one pass-through', () => {
    const searches = dialogRoutes.flatMap((route) =>
      route.options.validateSearch ? [route.options.validateSearch] : [],
    );
    // 23 drawers' prefills and params.
    expect(searches).toHaveLength(23);
    expect(new Set(searches).size).toBe(1);
  });

  it('loads each route’s own manifest — every registry name matches its route', async () => {
    for (const route of manifestBacked) {
      const manifest = await route.options.loader?.();
      expect(manifest?.path, route.id).toBe(route.fullPath);
    }
  });

  it('gates each one on its own manifest, then the org status guard — as before', async () => {
    for (const route of manifestBacked) {
      gatewayFromManifest.mockClear();
      vi.mocked(requireOrgStatus).mockClear();
      await route.options.beforeLoad?.(gateArgsFor(false));
      expect(gatewayFromManifest, route.id).toHaveBeenCalledExactlyOnceWith(
        await route.options.loader?.(),
      );
      expect(gatewayExecutor).toHaveBeenLastCalledWith({ kind: 'gate-context-sentinel' });
      expect(requireOrgStatus, route.id).toHaveBeenCalledOnce();
    }
  });

  it('skips the gate on a hover preload — the real navigation runs it', async () => {
    for (const route of manifestBacked)
      await route.options.beforeLoad?.(gateArgsFor(true));
    expect(gatewayFromManifest).not.toHaveBeenCalled();
    expect(requireOrgStatus).not.toHaveBeenCalled();
  });

  it('titles the document from the loaded manifest, and leaves the page’s title until it loads', async () => {
    const route = manifestBacked.find((item) => item.fullPath.endsWith('/leads/create'));
    const manifest = await route?.options.loader?.();
    expect(route?.options.head?.({ loaderData: manifest })).toEqual({
      meta: [{ title: composePageTitle('New lead') }],
    });
    expect(route?.options.head?.({})).toEqual({});
  });
});

describe('a dialog route refuses a member without its permission (L-54: RBAC as strong as before)', () => {
  const LEADS = '/organization/$organizationSlug/leads';
  const deny = vi.fn(() => {
    throw redirect({ to: '/unauthorized' });
  });

  beforeEach(() => {
    deny.mockClear();
    // The Leads page lets the member in; New lead's own manifest does not.
    gatewayFromManifest.mockImplementation((manifest) =>
      manifest.path === `${LEADS}/create` ? deny : gatewayExecutor,
    );
  });
  afterEach(() => {
    gatewayFromManifest.mockImplementation(() => gatewayExecutor);
  });

  it('on a cold load of its URL', async () => {
    const memoryRouter = memoryRouterAt('/organization/acme/leads/create?name=Asha');
    await memoryRouter.load();

    await vi.waitFor(() =>
      expect(memoryRouter.state.location.pathname).toBe('/unauthorized'),
    );
    expect(deny).toHaveBeenCalledOnce();
    expect(memoryRouter.state.matches.map((match) => match.routeId)).not.toContain(
      `${LEADS}/create`,
    );
  });

  it('on a navigation from its page', async () => {
    const memoryRouter = memoryRouterAt('/organization/acme/leads');
    await memoryRouter.load();
    expect(memoryRouter.state.location.pathname).toBe('/organization/acme/leads');

    await memoryRouter.navigate({
      to: '/organization/$organizationSlug/leads/create',
      params: { organizationSlug: 'acme' },
    });

    await vi.waitFor(() =>
      expect(memoryRouter.state.location.pathname).toBe('/unauthorized'),
    );
    expect(deny).toHaveBeenCalledOnce();
  });

  it('and lets a permitted member in', async () => {
    gatewayFromManifest.mockImplementation(() => gatewayExecutor);
    const memoryRouter = memoryRouterAt('/organization/acme/leads/create');
    await memoryRouter.load();

    expect(memoryRouter.state.location.pathname).toBe('/organization/acme/leads/create');
    expect(memoryRouter.state.matches.at(-1)?.routeId).toBe(`${LEADS}/create`);
    expect(deny).not.toHaveBeenCalled();
  });
});
