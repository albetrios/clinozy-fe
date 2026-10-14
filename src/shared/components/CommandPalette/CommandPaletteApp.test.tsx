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

import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import type { Role } from '@/shared/api/app/app-schema.ts';
import type * as CommandSearchApiModule from '@/shared/api/app/command-search-api.ts';
import type { CommandSearchPerson } from '@/shared/api/app/command-search-contracts.ts';
import { CROSS_ROOM_PARAM } from '@/shared/app/app-referrer.ts';
import { APP_SECTION_ORDER } from '@/shared/app/app-sections.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import type * as MyOrganizationSummariesModule from '@/shared/tenancy/my-organization-summaries.ts';
import { holdPreset, previewPreset } from '@/tests/utils/app-preset-codes.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { CommandPalette } from './CommandPalette.tsx';

/*
 * The command menu inside an organization (KICKOFF §6.0, L-28) on a real
 * router with the ten rooms' manifests — the nav, the codes and View-as run for
 * real; the search is clinozy-be's contacts search (`GET /app/contacts?q=`,
 * D158) over the people below.
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
/** A person the contacts search knows. */
const person = (
  key: string,
  name: string,
  overrides: Partial<CommandSearchPerson> = {},
): CommandSearchPerson => ({
  id: `con_${key.padEnd(21, '0')}`,
  name,
  contactNumber: 1000,
  phone: '+919825043212',
  patientId: null,
  patientNumber: null,
  openLeadId: null,
  ...overrides,
});

/** A patient (#3508), a person with only an open lead, one with neither, and a second patient. */
const DHARTI = person('dharti', 'Dharti Galani', {
  contactNumber: 1204,
  patientId: 'pat_dharti0000000000000000',
  patientNumber: 3508,
});
const RAVI = person('ravi', 'Ravi Galani', {
  contactNumber: 1310,
  phone: '+919825044120',
  openLeadId: 'lead_ravi00000000000000000',
});
const NEHA = person('neha', 'Neha Galani', { contactNumber: 1402 });
const PRONOTI = person('pronoti', 'Pronoti Sen', {
  contactNumber: 1500,
  patientId: 'pat_pronoti000000000000000',
  patientNumber: 3430,
});
const PEOPLE = [DHARTI, RAVI, NEHA, PRONOTI];

// `GET /app/contacts?q=`: a name part starting with the query, best match first; the
// minimum is the real module's.
vi.mock('@/shared/api/app/command-search-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof CommandSearchApiModule>()),
  searchAppCommands: async (query: string) => {
    const q = query.trim().toLowerCase();
    return {
      people: PEOPLE.filter(({ name }) =>
        name
          .toLowerCase()
          .split(' ')
          .some((part) => part.startsWith(q)),
      ),
    };
  },
}));
vi.mock('@/shared/tenancy/my-organization-summaries.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyOrganizationSummariesModule>()),
  useMyOrganizationSummaries: () => ({ data: [], isPending: false }),
}));

// The patient file the menu may open over (`patients/$patientId`): Dharti's, already read.
vi.mock('@/shared/hooks/usePatientFile/index.ts', () => ({
  usePatientFile: (patientId?: string) => ({
    data:
      patientId === 'pat_dharti0000000000000000'
        ? {
            patient: {
              id: 'pat_dharti0000000000000000',
              firstName: 'Dharti',
              lastName: 'Galani',
              seq: 3508,
              phone: '+919825043212',
            },
          }
        : undefined,
  }),
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
    module: `app-${section}`,
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
  const rooms = APP_SECTION_ORDER.map((section) =>
    roomRoute(() => organization, section),
  );
  const patientFile = createRoute({
    getParentRoute: () => organization,
    path: 'patients/$patientId',
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([organization.addChildren([...rooms, patientFile])]),
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
  return { ...utils, router, user, client };
}

/** The member holding the `role` preset's codes. */
function signIn(role: Role) {
  holdPreset(role);
}

const search = () => screen.getByRole('combobox', { name: 'Search' });
const group = (id: string) => screen.queryByTestId(`command-palette-group-${id}`);
const rowIds = (id: string, prefix: string) =>
  within(group(id) ?? document.createElement('div'))
    .queryAllByRole('option')
    .map((row) => row.dataset.testid?.replace(prefix, ''));
const peopleShown = () => rowIds('people', 'command-palette-person-');
const activeRow = () =>
  screen
    .getAllByRole('option')
    .find((row) => row.getAttribute('aria-selected') === 'true');

beforeEach(() => {
  tier.current = 'desktop';
  logoutMock.mockReset().mockResolvedValue(undefined);
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
/** A prescriber's actions: "Write prescription" after New patient (feat-prescription-composer). */
const PRESCRIBER_ACTIONS = [
  'new-lead',
  'new-appointment',
  'new-patient',
  'write-prescription',
  'new-receipt',
  'open-tasks',
];

/** What each preset is offered by its codes (`PRESET_CODES`; KICKOFF §3.7). */
const BY_ROLE: Record<Role, { actions: string[]; goTo: string[]; people: string[] }> = {
  owner: {
    actions: PRESCRIBER_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'stock'],
    people: [DHARTI.id, RAVI.id],
  },
  admin: {
    actions: PRESCRIBER_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'stock'],
    people: [DHARTI.id, RAVI.id],
  },
  doctor: {
    actions: [
      'new-lead',
      'new-appointment',
      'new-patient',
      'write-prescription',
      'open-tasks',
    ],
    goTo: ['leads', 'appointments', 'patients', 'payments'],
    people: [DHARTI.id, RAVI.id],
  },
  therapist: {
    actions: ['new-appointment', 'new-patient', 'open-tasks'],
    goTo: ['appointments', 'patients', 'stock', 'tasks'],
    people: [DHARTI.id],
  },
  front_desk: {
    actions: ALL_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'stock'],
    people: [DHARTI.id, RAVI.id],
  },
  counsellor: {
    actions: ALL_ACTIONS,
    goTo: ['leads', 'appointments', 'patients', 'payments'],
    people: [DHARTI.id, RAVI.id],
  },
  pharmacist: {
    actions: ['new-receipt', 'open-tasks'],
    goTo: ['appointments', 'patients', 'stock', 'payments'],
    people: [DHARTI.id],
  },
  accountant: {
    actions: ['new-receipt'],
    goTo: ['patients', 'stock', 'payments', 'offerings'],
    people: [DHARTI.id],
  },
  marketing: {
    actions: ['new-lead', 'open-tasks'],
    goTo: ['leads', 'patients', 'tasks', 'offerings'],
    people: [DHARTI.id, RAVI.id],
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

      // People once the contacts search takes the query: those the role can open — a patient
      // file with Patients view, a lead with Leads view; Neha, with neither, never.
      await user.clear(search());
      await user.type(search(), 'gal');
      await waitFor(() => expect(peopleShown()).toEqual(expected.people), {
        timeout: 3000,
      });
    },
  );

  it('narrows to the View-as role while a preview runs', async () => {
    const { client } = await renderMenu();
    expect(await screen.findByTestId('command-palette-action-new-receipt')).toBeVisible();

    act(() => previewPreset(client, 'doctor'));

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
      'Type 3+ letters or 4+ digits to search people',
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
      'Write prescriptionPatients',
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
    // Two letters search nobody yet: the hint stays until the third.
    expect(screen.getByTestId('command-palette-hint')).toBeVisible();
    await user.type(search(), 't');
    expect(screen.queryByTestId('command-palette-hint')).toBeNull();
  });

  it('lists the platform rows once typing — settings, theme and sign out stay reachable', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'log');

    expect(await screen.findByText('Log out')).toBeVisible();
  });

  it("shows the people the member can open, with the design's subs, the first active", async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'gal');

    const dharti = await screen.findByTestId(
      `command-palette-person-${DHARTI.id}`,
      undefined,
      { timeout: 3000 },
    );
    expect(within(group('people')!).getByText('People')).toBeVisible();
    // Each sub token isolated; the name and the sub read in their own direction.
    expect(dharti).toHaveTextContent(
      `Dharti Galani${fsi('#3508')} · •••• ${fsi('3212')}`,
    );
    expect(within(dharti).getByText('Dharti Galani')).toHaveAttribute('dir', 'auto');
    expect(
      within(dharti).getByText(`${fsi('#3508')} · •••• ${fsi('3212')}`),
    ).toHaveAttribute('dir', 'auto');
    // A lead's person by their contact number.
    expect(
      withoutBidiMarks(
        screen.getByTestId(`command-palette-person-${RAVI.id}`).textContent,
      ),
    ).toBe('Ravi GalaniC-1310 · •••• 4120');
    // Neither a patient file nor a lead: nothing to open.
    expect(screen.queryByTestId(`command-palette-person-${NEHA.id}`)).toBeNull();
    expect(activeRow()).toBe(dharti);
  });

  it('searches nothing below 3 letters — the hint stays', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'ga');

    expect(screen.getByTestId('command-palette-hint')).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(group('people')).toBeNull();
  });

  it('says "No matches" once the search has answered with nothing', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'zzqx');

    expect(
      await screen.findByText('No matches. Try a name, phone or C-number.', undefined, {
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
        await screen.findByTestId(`command-palette-person-${DHARTI.id}`, undefined, {
          timeout: 3000,
        }),
      );

      await waitFor(() =>
        expect(router.state.location.pathname).toBe(
          `/organization/acme/patients/${DHARTI.patientId}`,
        ),
      );
      expect(router.state.location.search).toEqual({ activity });
    },
  );

  it('opens a person with only a lead on the lead’s drawer route', async () => {
    const { router, user } = await renderMenu('/organization/acme/patients');
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'ravi');
    await user.click(
      await screen.findByTestId(`command-palette-person-${RAVI.id}`, undefined, {
        timeout: 3000,
      }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/leads/${RAVI.openLeadId}`,
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
    // "pro" reaches the "Profile" settings row at once and Pronoti Sen a beat
    // later, above it: Enter opens the patient the design puts first, not
    // whatever cmdk had picked before the search answered.
    const { router, user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'pro');
    expect(await screen.findByText('Profile')).toBeVisible();
    const first = await screen.findByTestId(
      `command-palette-person-${PRONOTI.id}`,
      undefined,
      { timeout: 3000 },
    );
    await waitFor(() => expect(activeRow()).toBe(first));
    expect(screen.getAllByRole('option')[0]).toBe(first);

    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${PRONOTI.patientId}`,
      ),
    );
  });

  it('leaves a row the user moved to where it is when the rows update', async () => {
    const { user } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');

    await user.type(search(), 'pro');
    await screen.findByTestId(`command-palette-person-${PRONOTI.id}`, undefined, {
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
    await user.type(search(), 'gal');
    await screen.findByTestId('command-palette-group-people', undefined, {
      timeout: 3000,
    });

    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});

describe('"Write prescription" — the patient finder (feat-prescription-composer §6.1)', () => {
  const RX_CREATE = `/organization/acme/patients/${DHARTI.patientId}/prescriptions/create`;

  it('is found by "rx", keeps the menu open as a finder of patients, and opens the drawer', async () => {
    const { user, router } = await renderMenu();
    await screen.findByTestId('command-palette-group-actions');
    await user.type(search(), 'rx');
    expect(rowIds('actions', 'command-palette-action-')).toEqual(['write-prescription']);

    await user.keyboard('{Enter}');

    expect(await screen.findByTestId('command-palette-mode')).toHaveTextContent(
      'Write prescription',
    );
    expect(search()).toHaveValue('');
    expect(search()).toHaveAttribute(
      'placeholder',
      'Which patient? Type a name or phone',
    );
    expect(search()).toHaveFocus();
    expect(screen.getByTestId('command-palette-hint')).toHaveTextContent(
      'Type 3+ letters or 4+ digits to find a patient',
    );
    expect(group('actions')).toBeNull();

    // Patients only: Ravi has an open lead and no file, Neha neither.
    await user.type(search(), 'gal');
    await waitFor(() =>
      expect(rowIds('patients', 'command-palette-prescribe-')).toEqual([DHARTI.id]),
    );
    expect(screen.queryByText('Log out')).toBeNull();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe(RX_CREATE));
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('offers the patient file under the menu first, and Backspace leaves the finder', async () => {
    const { user, router } = await renderMenu(
      `/organization/acme/patients/${DHARTI.patientId}`,
    );
    await user.click(
      await screen.findByTestId('command-palette-action-write-prescription'),
    );

    const here = await screen.findByTestId('command-palette-prescribe-this-patient');
    expect(
      within(group('this-patient') as HTMLElement).getByText('This patient'),
    ).toBeVisible();
    expect(withoutBidiMarks(here.textContent ?? '')).toBe(
      'Dharti Galani#3508 · •••• 3212',
    );
    expect(activeRow()).toBe(here);

    await user.keyboard('{Backspace}');
    expect(screen.queryByTestId('command-palette-mode')).toBeNull();
    expect(await screen.findByTestId('command-palette-group-actions')).toBeVisible();

    await user.click(screen.getByTestId('command-palette-action-write-prescription'));
    await user.click(await screen.findByTestId('command-palette-mode-leave'));
    expect(screen.queryByTestId('command-palette-mode')).toBeNull();

    await user.click(screen.getByTestId('command-palette-action-write-prescription'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe(RX_CREATE));
  });

  it('has no axe violations in the finder', async () => {
    const { user, baseElement } = await renderMenu();
    await user.click(
      await screen.findByTestId('command-palette-action-write-prescription'),
    );
    await user.type(search(), 'gal');
    await screen.findByTestId(`command-palette-prescribe-${DHARTI.id}`);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
