import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type OrganizationPermission,
  organizationPermissionSchema,
} from '@/core/types/permissions.ts';
import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { useRoomLanding } from './useRoomLanding.ts';

const disabled = vi.hoisted(() => ({ modules: new Set<string>() }));
vi.mock('@/core/security/gates/require-module.ts', () => ({
  isModuleEnabled: (key: string) => !disabled.modules.has(key),
}));

const OWNER_CODES = [...organizationPermissionSchema.options];
/** clinozy-be's seeded Member: reads the org, its members and its roles. */
const MEMBER_CODES: OrganizationPermission[] = [
  'organization:read',
  'membership:read',
  'role:read',
];

/** Each page names itself, so a test sees where the member is. */
const PAGES = [
  'today',
  'leads',
  'appointments',
  'patients',
  'medical',
  'users',
  'dashboard',
];

/**
 * The org layout as the route tree mounts it — the guard over an `<Outlet />`
 * — with a page per room (and the non-room dashboard), opened at `path`, for
 * `email` holding `codes`, previewing `previewRole`.
 */
function renderLayout(
  path: string,
  {
    email = 'owner@elsewhere.com',
    codes = OWNER_CODES,
    previewRole = null,
  }: {
    email?: string;
    /** Null: the permission set hasn't answered yet. */
    codes?: OrganizationPermission[] | null;
    previewRole?: ClinicRoleKey | null;
  } = {},
) {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  if (codes) useOrganizationStore.getState().setPermissions(codes);
  else useOrganizationStore.getState().clearPermissions();
  useAuthStore.setState({ user: { id: 'usr_me', email, role: 'user' } as AuthUser });
  useUIStore.setState({ previewRole });

  const root = createRootRoute({ component: () => <Outlet /> });
  const layout = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug',
    component: function Layout() {
      useRoomLanding();
      return <Outlet />;
    },
  });
  const pages = PAGES.map((page) =>
    createRoute({
      getParentRoute: () => layout,
      path: page,
      component: () => <p data-testid="page">{page}</p>,
    }),
  );
  const router = createRouter({
    routeTree: root.addChildren([layout.addChildren(pages)]),
    history: createMemoryHistory({ initialEntries: [`/organization/acme/${path}`] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

async function expectPage(page: string) {
  await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent(page));
}

beforeEach(() => {
  disabled.modules.clear();
  resetClinicFixtures();
  resetClinicAccessFixture();
});
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useAuthStore.setState({ user: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('useRoomLanding (Q-U11)', () => {
  it('takes a previewed Doctor off Users to Leads, replacing the entry', async () => {
    const { router } = renderLayout('users', { previewRole: 'doctor' });
    await expectPage('leads');
    expect(router.state.location.pathname).toBe('/organization/acme/leads');
    expect(router.history).toHaveLength(1);
  });

  it('keeps the hash — an open Settings modal — on the way', async () => {
    const { router } = renderLayout('users#settings/organization/general', {
      previewRole: 'doctor',
    });
    await expectPage('leads');
    expect(router.state.location.hash).toBe('settings/organization/general');
  });

  it('keeps a room the access in force can view', async () => {
    const { router } = renderLayout('patients', { previewRole: 'doctor' });
    await expectPage('patients');
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/organization/acme/patients');
  });

  it('leaves a path outside the rooms alone', async () => {
    const { router } = renderLayout('dashboard', { previewRole: 'marketing' });
    await expectPage('dashboard');
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/organization/acme/dashboard');
  });

  it('stays put on "Exit preview" when the member’s own access views the room', async () => {
    const { router } = renderLayout('users', { previewRole: 'marketing' });
    await expectPage('leads');
    act(() => useUIStore.getState().setPreviewRole(null));
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/organization/acme/leads');
  });

  it('lands "Exit preview" on the first room the member’s own access views', async () => {
    // Reenal is a Doctor; previewing Pharmacist, she opens Medical.
    const { router } = renderLayout('medical', {
      email: 'reenal@cresence.skin',
      codes: MEMBER_CODES,
      previewRole: 'pharmacist',
    });
    await expectPage('medical');
    act(() => useUIStore.getState().setPreviewRole(null));
    await expectPage('leads');
    expect(router.state.location.pathname).toBe('/organization/acme/leads');
  });

  it('never lands on a room the deployment turns off', async () => {
    disabled.modules.add('clinic-leads');
    renderLayout('users', { previewRole: 'doctor' });
    await expectPage('appointments');
  });

  it('waits for the access to resolve before moving anyone', async () => {
    const { router } = renderLayout('users', { codes: null, previewRole: 'doctor' });
    await expectPage('users');
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/organization/acme/users');
  });
});
