import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireOrgStatus } from '@/app/guards/org-gates.ts';
import { manifest as offeringEditManifest } from '@/pages/organization/$organizationSlug/offerings/$offeringId/edit/edit.manifest.ts';
import { manifest as offeringCreateManifest } from '@/pages/organization/$organizationSlug/offerings/create/create.manifest.ts';
import { manifest as offeringsManifest } from '@/pages/organization/$organizationSlug/offerings/offerings.manifest.ts';
import {
  validateOfferingCreateSearch,
  validateOfferingsSearch,
} from '@/pages/organization/$organizationSlug/offerings/offerings.search.ts';
import { manifest as offersManifest } from '@/pages/organization/$organizationSlug/offerings/offers/offers.manifest.ts';
import { validateOffersSearch } from '@/pages/organization/$organizationSlug/offerings/offers/offers.search.ts';

import { router } from './routeTree.tsx';

/*
 * The Offerings room's routes as `routeTree.tsx` registers them (KICKOFF §4,
 * §6.11; D24; S:98–103) — kept apart from `routeTree.test.tsx` so rooms built
 * side by side add their own route checks without editing one file.
 */

const gatewayExecutor = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const gatewayFromManifest = vi.hoisted(() =>
  vi.fn(() => gatewayExecutor as (context: unknown) => Promise<void>),
);

vi.mock('@/shared/layouts/AuthLayout/auth-layout-variants.ts', () => ({
  preloadAuthLayoutVariant: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/shared/layouts/AppLayout/app-layout-variants.ts', () => ({
  preloadSessionAppShell: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/core/security/gateway.ts', () => ({ gatewayFromManifest }));
vi.mock('@/core/security/gate-context.ts', () => ({
  toGateContext: vi.fn(() => ({ kind: 'gate-context-sentinel' })),
}));
vi.mock('@/core/rbac/guards.ts', () => ({
  requireAuth: vi.fn().mockResolvedValue(undefined),
  redirectIfAuthenticated: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/app/guards/org-gates.ts', () => ({
  requireOrgStatus: vi.fn(),
  requirePersonalDashboardWorkspace: vi.fn().mockResolvedValue(undefined),
  requirePersonalDeployment: vi.fn(),
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

const OFFERINGS = '/organization/$organizationSlug/offerings';
const OFFERS = `${OFFERINGS}/offers`;
const OFFERING_CREATE = `${OFFERINGS}/create`;
const OFFERING_EDIT = `${OFFERINGS}/$offeringId/edit`;

type OfferingsRoute = {
  options: {
    validateSearch?: unknown;
    staticData?: { manifest?: { nav?: unknown } };
    beforeLoad?: (context: Record<string, unknown>) => Promise<void> | void;
  };
};
const routeOf = (id: string) =>
  (router.routesById as unknown as Record<string, OfferingsRoute | undefined>)[id];

beforeEach(() => {
  gatewayExecutor.mockClear();
  gatewayFromManifest.mockClear();
  vi.mocked(requireOrgStatus).mockClear();
});

describe('the Offerings room’s routes (KICKOFF §4, D24, S:98–103)', () => {
  it('registers the Offerings tab with its dialog routes and, beside it, the Offers tab', () => {
    const ids = Object.keys(router.routesById)
      .filter((id) => id === OFFERINGS || id.startsWith(`${OFFERINGS}/`))
      .sort();
    expect(ids).toEqual([OFFERINGS, OFFERING_EDIT, OFFERING_CREATE, OFFERS]);
  });

  it('validates each tab’s own search, and the New offering prefill', () => {
    expect(routeOf(OFFERINGS)?.options.validateSearch).toBe(validateOfferingsSearch);
    expect(routeOf(OFFERS)?.options.validateSearch).toBe(validateOffersSearch);
    expect(routeOf(OFFERING_CREATE)?.options.validateSearch).toBe(
      validateOfferingCreateSearch,
    );
  });

  it.each([
    [OFFERINGS, offeringsManifest],
    [OFFERS, offersManifest],
    [OFFERING_CREATE, offeringCreateManifest],
    [OFFERING_EDIT, offeringEditManifest],
  ] as const)(
    '%s runs the room gateway on its own manifest, then the status guard',
    async (id, manifest) => {
      await routeOf(id)?.options.beforeLoad?.({
        location: { href: '/organization/acme/offerings' },
        params: { organizationSlug: 'acme' },
        preload: false,
      });
      expect(gatewayFromManifest).toHaveBeenCalledWith(manifest);
      expect(gatewayExecutor).toHaveBeenCalledWith({ kind: 'gate-context-sentinel' });
      expect(requireOrgStatus).toHaveBeenCalledTimes(1);
      expect(routeOf(id)?.options.staticData?.manifest).toBe(manifest);
    },
  );

  it('puts only the room in the nav, never its Offers tab or its dialogs', () => {
    expect(routeOf(OFFERINGS)?.options.staticData?.manifest?.nav).toBeDefined();
    for (const id of [OFFERS, OFFERING_CREATE, OFFERING_EDIT]) {
      expect(routeOf(id)?.options.staticData?.manifest?.nav).toBeUndefined();
    }
  });

  it('matches an offering’s edit URL to its dialog route, over the Offerings tab', async () => {
    const memoryRouter = createRouter({
      routeTree: router.routeTree,
      history: createMemoryHistory({
        initialEntries: ['/organization/acme/offerings/O1/edit?q=peel'],
      }),
    });
    await memoryRouter.load();
    expect(memoryRouter.state.matches.map((match) => match.routeId)).toContain(OFFERINGS);
    expect(memoryRouter.state.matches.at(-1)?.routeId).toBe(OFFERING_EDIT);
    expect(memoryRouter.state.matches.at(-1)?.params).toMatchObject({ offeringId: 'O1' });
  });

  it('matches the Offers URL to the Offers tab, not the Offerings tab', async () => {
    const memoryRouter = createRouter({
      routeTree: router.routeTree,
      history: createMemoryHistory({
        initialEntries: ['/organization/acme/offerings/offers?status=live'],
      }),
    });
    await memoryRouter.load();
    expect(memoryRouter.state.matches.at(-1)?.routeId).toBe(OFFERS);
    // The tab's own schema reads the URL: one state becomes the list it filters by.
    expect(memoryRouter.state.matches.at(-1)?.search).toMatchObject({ status: ['live'] });
  });
});
