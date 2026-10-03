import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { organizationPermissionSchema } from '@/core/types/permissions.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { House, LayoutDashboard } from '@/shared/icons/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { navCandidates, type NavRoute, useAppNav } from './useAppNav.ts';

const ORG = '/organization/$organizationSlug';

/** clinozy-be's org owner holds every code — the Users room needs membership:read and role:read (D17). */
const OWNER_CODES = [...organizationPermissionSchema.options];

function manifest(
  segment: string,
  nav: PageManifest['nav'],
  module?: string,
): PageManifest {
  return {
    segment,
    path: `${ORG}/${segment}`,
    title: segment,
    testId: `${segment}-page`,
    permission: 'organization:read',
    ...(module ? { module } : {}),
    kind: 'leaf',
    children: [],
    nav,
  };
}

const room = (section: string): NavRoute => ({
  fullPath: `${ORG}/${section}`,
  manifest: manifest(section, { id: section, section }, `clinic-${section}`),
});
const orgDashboard: NavRoute = {
  fullPath: `${ORG}/dashboard`,
  manifest: manifest('dashboard', { id: 'dashboard' }, 'billing'),
};
const personalDashboard: NavRoute = { ...orgDashboard, fullPath: '/dashboard' };
const enabled = () => true;
const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id);

describe('navCandidates', () => {
  it('lists the clinic rooms in section order, without the template Dashboard', () => {
    const routes = [room('users'), orgDashboard, room('today'), room('leads')];
    const entries = navCandidates(routes, 'organization', enabled);
    expect(ids(entries)).toEqual(['today', 'leads', 'users']);
    expect(entries[0]).toMatchObject({
      to: `${ORG}/today`,
      section: 'today',
      icon: House,
      labelNs: 'clinic',
      labelKey: 'sections.today.label',
      permission: 'organization:read',
    });
  });

  it('falls back to the Dashboard when the deployment enables no clinic room', () => {
    const routes = [room('today'), room('leads'), orgDashboard];
    const entries = navCandidates(
      routes,
      'organization',
      (key) => !key.startsWith('clinic-'),
    );
    expect(ids(entries)).toEqual(['dashboard']);
    expect(entries[0]).toMatchObject({
      section: null,
      icon: LayoutDashboard,
      labelNs: 'layout',
    });
  });

  it('keeps the personal tree apart from the organization tree', () => {
    const routes = [room('today'), orgDashboard, personalDashboard];
    expect(navCandidates(routes, 'personal', enabled)).toMatchObject([
      { id: 'dashboard', to: '/dashboard' },
    ]);
  });

  it('drops a disabled room, an unknown section and an unknown template page', () => {
    const routes = [
      room('today'),
      room('leads'),
      {
        fullPath: `${ORG}/wards`,
        manifest: manifest('wards', { id: 'wards', section: 'wards' }),
      },
      { fullPath: `${ORG}/reports`, manifest: manifest('reports', { id: 'reports' }) },
      { fullPath: `${ORG}/inbox`, manifest: manifest('inbox', undefined) },
    ];
    expect(
      ids(navCandidates(routes, 'organization', (key) => key !== 'clinic-leads')),
    ).toEqual(['today']);
  });
});

function Probe() {
  const nav = useAppNav('organization');
  return (
    <output data-testid="nav">
      {nav.isResolved ? ids(nav.entries).join(',') : 'pending'}
    </output>
  );
}

function renderNav() {
  const root = createRootRoute({ component: () => <Outlet /> });
  const org = createRoute({ getParentRoute: () => root, path: ORG, component: Probe });
  const children = [room('users'), room('today'), room('leads'), orgDashboard].map(
    (route) =>
      createRoute({
        getParentRoute: () => org,
        path: route.manifest.segment,
        staticData: { manifest: route.manifest },
        component: () => null,
      }),
  );
  const router = createRouter({
    routeTree: root.addChildren([org.addChildren(children)]),
    history: createMemoryHistory({ initialEntries: ['/organization/acme/today'] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'usr_1', email: 'o@e.com', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().clearPermissions();
  useUIStore.getState().setPreviewRole(null);
});

describe('useAppNav', () => {
  it('waits for the permission set', async () => {
    renderNav();
    expect(await screen.findByTestId('nav')).toHaveTextContent('pending');
  });

  it('gives the org owner every room the tree has', async () => {
    useOrganizationStore.getState().setPermissions(OWNER_CODES);
    renderNav();
    expect(await screen.findByText('today,leads,users')).toBeInTheDocument();
  });

  it('shows a member with no clinic role Today only', async () => {
    useOrganizationStore.getState().setPermissions(['organization:read']);
    renderNav();
    expect(await screen.findByText('today')).toBeInTheDocument();
  });

  it('follows a View-as preview', async () => {
    useOrganizationStore.getState().setPermissions(OWNER_CODES);
    renderNav();
    await screen.findByText('today,leads,users');
    act(() => useUIStore.getState().setPreviewRole('doctor'));
    expect(await screen.findByText('today,leads')).toBeInTheDocument();
  });

  it('hides a room whose route permission the member lacks', async () => {
    useOrganizationStore.getState().setPermissions(['organization:delete']);
    renderNav();
    expect(await screen.findByTestId('nav')).toHaveTextContent(/^$/);
  });
});
