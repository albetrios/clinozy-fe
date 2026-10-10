import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { CROSS_ROOM_PARAM } from '@/shared/clinic/clinic-referrer.ts';
import { CLINIC_SECTION_ORDER } from '@/shared/clinic/clinic-sections.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import type * as MyOrganizationSummariesModule from '@/shared/tenancy/my-organization-summaries.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { CommandPalette } from './CommandPalette.tsx';

/*
 * The command menu inside an organization (KICKOFF §6.0, L-28) on a real
 * router with the ten rooms' manifests — the nav, the access matrix, View-as
 * and the fixture search all run for real. Owner and Admin come from the
 * platform permissions; every other role through View-as (staff roles join
 * with L-31).
 */

const tier = vi.hoisted(() => ({ current: 'desktop' as 'phone' | 'tablet' | 'desktop' }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
  readViewportTier: () => tier.current,
}));
const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock('@/shared/auth/service.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  logout: logoutMock,
}));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: { activeOrganization: { type: 'TEAM' } } }),
}));
vi.mock('@/shared/tenancy/my-organization-summaries.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyOrganizationSummariesModule>()),
  useMyOrganizationSummaries: () => ({ data: [], isPending: false }),
}));

const ORG = '/organization/$organizationSlug';

function roomRoute(
  parent: Parameters<typeof createRoute>[0]['getParentRoute'],
  section: string,
) {
  const manifest: PageManifest = {
    segment: section,
    path: `${ORG}/${section}`,
    title: section,
    testId: `${section}-page`,
    permission: 'organization:read',
    module: `clinic-${section}`,
    kind: 'leaf',
    children: [],
    nav: { id: section, section },
  };
  return createRoute({
    getParentRoute: parent,
    path: section,
    staticData: { manifest },
    component: () => null,
  });
}

async function renderMenu(path = '/organization/acme/today') {
  const root = createRootRoute({ component: () => <Outlet /> });
  const organization = createRoute({
    getParentRoute: () => root,
    path: ORG,
    component: () => (
      <>
        <CommandPalette />
        <Outlet />
      </>
    ),
  });
  const rooms = CLINIC_SECTION_ORDER.map((section) =>
    roomRoute(() => organization, section),
  );
  const router = createRouter({
    routeTree: root.addChildren([organization.addChildren(rooms)]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('combobox', { name: 'Search' });
  return { ...utils, router, user };
}

/** The codes clinozy-be gives Owner and Admin for the rooms already on it (Leads, Appointments). */
const LIVE_ROOM_CODES: OrganizationPermission[] = [
  'lead:read',
  'lead:create',
  'appointment:read',
  'appointment:create',
];

/** The member: Owner and Admin from their platform codes, any other role by View-as. */
function signIn(role: Role) {
  const permissions: Partial<Record<Role, OrganizationPermission[]>> = {
    owner: ['organization:read', 'organization:delete', ...LIVE_ROOM_CODES],
    admin: ['organization:read', 'role:manage', ...LIVE_ROOM_CODES],
  };
  useOrganizationStore
    .getState()
    .setPermissions(permissions[role] ?? ['organization:read']);
  useUIStore.getState().setPreviewRole(permissions[role] ? null : role);
}

const search = () => screen.getByRole('combobox', { name: 'Search' });
const group = (id: string) => screen.queryByTestId(`command-palette-group-${id}`);
const rowIds = (id: string, prefix: string) =>
  within(group(id) ?? document.createElement('div'))
    .queryAllByRole('option')
    .map((row) => row.dataset.testid?.replace(prefix, ''));
const resultGroups = () =>
  ['patients', 'leads', 'invoices'].filter((id) => group(id) !== null);
const activeRow = () =>
  screen
    .getAllByRole('option')
    .find((row) => row.getAttribute('aria-selected') === 'true');

beforeEach(() => {
  tier.current = 'desktop';
  logoutMock.mockReset().mockResolvedValue(undefined);
  resetClinicFixtures();
  useAuthStore.setState({
    user: { id: 'usr_1', email: 'o@e.com', role: 'user' } as AuthUser,
  });
  useUIStore.setState({ commandPaletteOpen: true });
  signIn('owner');
});
afterEach(() => {
  act(() => {
    useUIStore.setState({ commandPaletteOpen: false, previewRole: null });
  });
  useOrganizationStore.getState().clearPermissions();
});

const ALL_ACTIONS = [
  'new-lead',
  'new-appointment',
  'new-patient',
  'new-receipt',
  'open-tasks',
];

/** What each role is offered (access.fixtures.ts; KICKOFF §3.7). */
const BY_ROLE: Record<
  Role,
  { actions: string[]; goTo: string[]; results: ('patients' | 'leads' | 'invoices')[] }
> = {
  owner: {
    actions: ALL_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'stock'],
    results: ['patients', 'leads', 'invoices'],
  },
  admin: {
    actions: ALL_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'stock'],
    results: ['patients', 'leads', 'invoices'],
  },
  doctor: {
    actions: ['new-lead', 'new-appointment', 'new-patient', 'open-tasks'],
    goTo: ['leads', 'appointments', 'patients', 'tasks'],
    results: ['patients', 'leads'],
  },
  therapist: {
    actions: ['open-tasks'],
    goTo: ['appointments', 'patients', 'stock', 'tasks'],
    results: ['patients'],
  },
  front_desk: {
    actions: ALL_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'stock'],
    results: ['patients', 'leads', 'invoices'],
  },
  counsellor: {
    actions: ALL_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'payments'],
    results: ['patients', 'leads', 'invoices'],
  },
  pharmacist: {
    actions: ['new-patient', 'open-tasks'],
    goTo: ['patients', 'stock', 'tasks'],
    results: ['patients'],
  },
  accountant: {
    actions: ['new-receipt', 'open-tasks'],
    goTo: ['stock', 'payments', 'tasks'],
    results: ['invoices'],
  },
  marketing: {
    actions: ['new-lead', 'open-tasks'],
    goTo: ['leads', 'tasks'],
    results: ['leads'],
  },
};

describe('the command menu per role (L-28 acceptance)', () => {
  it.each(Object.keys(BY_ROLE) as Role[])(
    '%s sees the actions, rooms and results its access allows',
    async (role) => {
      signIn(role);
      const { user } = await renderMenu();
      const expected = BY_ROLE[role];

      // "Actions" from the start, each where the role may create (or view Tasks).
      await waitFor(() =>
        expect(rowIds('actions', 'command-palette-action-')).toEqual(expected.actions),
      );

      // "Go to" once typing: the rooms it can view, at most four, never Today.
      await user.type(search(), 's');
      expect(rowIds('go-to', 'command-palette-go-to-')).toEqual(expected.goTo);

      // From two letters, only the groups its access can read.
      await user.clear(search());
      await user.type(search(), 'dh');
      await waitFor(() => expect(resultGroups()).toEqual(expected.results), {
        timeout: 3000,
      });
    },
  );

  it('narrows to the View-as role while a preview runs', async () => {
    await renderMenu();
    expect(await screen.findByTestId('command-palette-action-new-receipt')).toBeVisible();

    act(() => useUIStore.getState().setPreviewRole('doctor'));

    await waitFor(() =>
      expect(screen.queryByTestId('command-palette-action-new-receipt')).toBeNull(),
    );
    expect(screen.getByTestId('command-palette-action-new-lead')).toBeVisible();
  });
});

describe('the command menu (KICKOFF §6.0; _patterns.md:195–207)', () => {
  it('draws the design: "Command menu", the search row with esc, Results and the footer', async () => {
    await renderMenu();

    expect(screen.getByRole('dialog', { name: 'Command menu' })).toBeVisible();
    expect(await screen.findByRole('combobox', { name: 'Search' })).toHaveAttribute(
      'placeholder',
      'Search or jump to…',
    );
    expect(search()).toHaveFocus();
    expect(screen.getByText('esc')).toHaveAttribute('data-slot', 'kbd');
    expect(screen.getByRole('listbox', { name: 'Results' })).toBeVisible();
    const footer = screen.getByTestId('command-palette-footer');
    expect(footer).toHaveTextContent('↑↓move↵open');
    expect(within(footer).getByTestId('command-palette-hint')).toHaveTextContent(
      'Type 2+ letters to search patients, leads and invoices',
    );
  });

  it('opens on "Actions" alone, each with its room, the first row active', async () => {
    await renderMenu();

    const actions = await screen.findByTestId('command-palette-group-actions');
    expect(within(actions).getByText('Actions')).toBeVisible();
    expect(
      within(actions)
        .getAllByRole('option')
        .map((row) => row.textContent),
    ).toEqual([
      'New leadLeads',
      'New appointmentAppointments',
      'New patientPatients',
      'New receiptPayments',
      'Open tasksTasks',
    ]);
    expect(activeRow()).toHaveTextContent('New lead');
    // The platform rows wait for a query.
    expect(screen.queryByText('Log out')).toBeNull();
    expect(group('go-to')).toBeNull();
  });

  it('filters the actions by what is typed and lists "Go to" rooms as "Screen"', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'pa');

    expect(rowIds('actions', 'command-palette-action-')).toEqual(['new-patient']);
    const goTo = group('go-to');
    expect(
      within(goTo!)
        .getAllByRole('option')
        .map((row) => row.textContent),
    ).toEqual(['PatientsScreen', 'PaymentsScreen']);
    expect(screen.queryByTestId('command-palette-hint')).toBeNull();
  });

  it('lists the platform rows once typing — settings, theme and sign out stay reachable', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'log');

    expect(await screen.findByText('Log out')).toBeVisible();
  });

  it("shows patients, leads and invoices with the design's subs, capped per group", async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'dh');

    const dharti = await screen.findByTestId(
      `command-palette-patient-${ref.patient(3508)}`,
      undefined,
      { timeout: 3000 },
    );
    // Each sub token isolated; the name and the sub read in their own direction.
    expect(dharti).toHaveTextContent(
      `Dharti Galani${fsi('#3508')} · •••• ${fsi('3212')}`,
    );
    expect(within(dharti).getByText('Dharti Galani')).toHaveAttribute('dir', 'auto');
    expect(
      within(dharti).getByText(`${fsi('#3508')} · •••• ${fsi('3212')}`),
    ).toHaveAttribute('dir', 'auto');
    expect(
      withoutBidiMarks(
        screen.getByTestId(`command-palette-lead-${ref.lead(2352)}`).textContent,
      ),
    ).toBe('Dharti Galani#2352 · Clinic visited');
    const invoice = screen.getByTestId(`command-palette-invoice-${ref.invoice(787)}`);
    expect(withoutBidiMarks(invoice.textContent)).toMatch(
      /^Clinic invoice #787Dharti Galani · /,
    );
    expect(activeRow()).toBe(dharti);

    await user.clear(search());
    await user.type(search(), 'an');
    await waitFor(() => expect(rowIds('patients', '')).toHaveLength(6));
    expect(rowIds('leads', '').length).toBeLessThanOrEqual(5);
    expect(rowIds('invoices', '').length).toBeLessThanOrEqual(4);
  });

  it('names a re-target lead still New "Re-targeted" and never lists a contact thread', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'kavya');
    expect(
      await screen.findByTestId(`command-palette-lead-${ref.lead(2371)}`, undefined, {
        timeout: 3000,
      }),
    ).toHaveTextContent(`${fsi('#2371')} · ${fsi('Re-targeted')}`);

    await user.clear(search());
    await user.type(search(), 'neha');
    await screen.findByTestId(`command-palette-patient-${ref.patient(551)}`, undefined, {
      timeout: 3000,
    });
    expect(group('leads')).toBeNull();
  });

  it('says "No matches" once the search has answered with nothing', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'zzqx');

    expect(
      await screen.findByText('No matches. Try a name, phone or #ID.', undefined, {
        timeout: 3000,
      }),
    ).toBeVisible();
  });
});

describe('the command menu opens the routes (D24, D19 / D26; §7.3)', () => {
  it.each([
    ['new-lead', '/organization/acme/leads/create'],
    ['new-patient', '/organization/acme/patients/create'],
    ['open-tasks', '/organization/acme/tasks'],
  ])('%s → %s', async (action, pathname) => {
    const { router, user } = await renderMenu();

    await user.click(await screen.findByTestId(`command-palette-action-${action}`));

    await waitFor(() => expect(router.state.location.pathname).toBe(pathname));
    expect(router.state.location.search).toEqual({});
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it.each([
    ['new-appointment', 'appointments/create?from=today'],
    ['new-receipt', 'payments/receive?from=today'],
  ])('%s → %s, over the page it was asked from (A-P1)', async (action, drawer) => {
    const { router, user } = await renderMenu();

    await user.click(await screen.findByTestId(`command-palette-action-${action}`));

    await waitFor(() =>
      expect(router.history.location.href).toBe(`/organization/acme/${drawer}`),
    );
    expect(router.state.location.pathname).toBe('/organization/acme/today');
    expect(router.state.location.search).toEqual({ [CROSS_ROOM_PARAM]: drawer });
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it.each([
    ['desktop', 'open'],
    ['tablet', 'open'],
    ['phone', 'closed'],
  ] as const)(
    'opens a patient file on %s with Activity %s (H:4605)',
    async (viewport, activity) => {
      tier.current = viewport;
      const { router, user } = await renderMenu();
      await screen.findByTestId('command-palette-group-actions');

      await user.type(search(), 'dharti');
      await user.click(
        await screen.findByTestId(
          `command-palette-patient-${ref.patient(3508)}`,
          undefined,
          {
            timeout: 3000,
          },
        ),
      );

      await waitFor(() =>
        expect(router.state.location.pathname).toBe(
          `/organization/acme/patients/${ref.patient(3508)}`,
        ),
      );
      expect(router.state.location.search).toEqual({ activity });
    },
  );

  it('opens a lead on its drawer route, an invoice over the page it came from (A-P1)', async () => {
    const { router, user } = await renderMenu('/organization/acme/patients');
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), '#787');
    await user.click(
      await screen.findByTestId(
        `command-palette-invoice-${ref.invoice(787)}`,
        undefined,
        {
          timeout: 3000,
        },
      ),
    );
    const invoice = `invoices/${ref.invoice(787)}?from=patients`;
    await waitFor(() =>
      expect(router.history.location.href).toBe(`/organization/acme/${invoice}`),
    );
    expect(router.state.location.pathname).toBe('/organization/acme/patients');
    expect(router.state.location.search).toEqual({ [CROSS_ROOM_PARAM]: invoice });

    act(() => useUIStore.getState().setCommandPaletteOpen(true));
    await user.type(await screen.findByRole('combobox', { name: 'Search' }), 'galani');
    await user.click(
      await screen.findByTestId(`command-palette-lead-${ref.lead(2352)}`, undefined, {
        timeout: 3000,
      }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/leads/${ref.lead(2352)}`,
      ),
    );
  });

  it('jumps to a room from "Go to"', async () => {
    const { router, user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'pay');
    await user.click(screen.getByTestId('command-palette-go-to-payments'));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
  });
});

describe('the command menu keys (↑↓ wrap · ↵ opens · Esc closes)', () => {
  it('moves the active row, wraps at both ends and opens it on Enter', async () => {
    const { router, user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.keyboard('{ArrowDown}');
    expect(activeRow()).toHaveTextContent('New appointment');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(activeRow()).toHaveTextContent('Open tasks');
    await user.keyboard('{ArrowDown}');
    expect(activeRow()).toHaveTextContent('New lead');

    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/leads/create'),
    );
  });

  it('keeps the first row active when the search answers above the platform rows', async () => {
    // "ro" reaches the "Profile" settings row at once and Rohan Pillai a beat
    // later, above it: Enter opens the patient the design puts first, not
    // whatever cmdk had picked before the search answered.
    const { router, user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'ro');
    expect(await screen.findByText('Profile')).toBeVisible();
    const first = await screen.findByTestId(
      `command-palette-patient-${ref.patient(3430)}`,
      undefined,
      { timeout: 3000 },
    );
    await waitFor(() => expect(activeRow()).toBe(first));
    expect(screen.getAllByRole('option')[0]).toBe(first);

    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${ref.patient(3430)}`,
      ),
    );
  });

  it('leaves a row the user moved to where it is when the rows update', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'ro');
    await screen.findByTestId(`command-palette-patient-${ref.patient(3430)}`, undefined, {
      timeout: 3000,
    });
    await user.keyboard('{ArrowDown}');
    const moved = activeRow();

    expect(moved).not.toBe(screen.getAllByRole('option')[0]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(activeRow()).toBe(moved);
  });

  it('closes on Esc', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.keyboard('{Escape}');

    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });
});

describe('the command menu — accessibility', () => {
  it('has no violations with every group open', async () => {
    const { baseElement, user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');
    await user.type(search(), 'dh');
    await screen.findByTestId('command-palette-group-invoices', undefined, {
      timeout: 3000,
    });

    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
