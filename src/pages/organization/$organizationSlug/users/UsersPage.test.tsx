import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as CsvModule from '@/lib/csv.ts';
import type * as BranchesApiModule from '@/shared/api/app/branches-api.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';

import {
  member,
  PLATFORM_ROLES,
  renderUsersRoutes,
  resetUsersRoutes,
  SELF,
} from './__tests__/integration/users-test-router.tsx';
import { UsersPage } from './UsersPage.tsx';

// jsdom has no layout: pin the desktop tier, where rows are selectable.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  fetchActiveBranches: vi.fn(),
  downloadCsv: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  listMembers: api.listMembers,
  listRoles: api.listRoles,
}));
vi.mock('@/shared/api/app/branches-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesApiModule>()),
  fetchActiveBranches: api.fetchActiveBranches,
}));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof CsvModule>()),
  downloadCsv: api.downloadCsv,
}));

const IN_A_WEEK = new Date(Date.now() + 7 * 86_400_000).toISOString();

/** An open branch, as the header picker reads it. */
const branchOption = (id: string, name: string, isMain: boolean): BranchOption => ({
  id,
  name,
  tone: isMain ? 'mint' : 'lav',
  isMain,
  opensAt: '10:00',
  closesAt: '19:00',
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
});
const ADAJAN = branchOption('brn_adajan000000000000000', 'Adajan', true);
const VESU = branchOption('brn_vesu00000000000000000', 'Vesu', false);

/** The roster: you (Riya — Front desk and Admin), a doctor, the owner and an invitation. */
const RIYA = member(
  'riya',
  SELF.email,
  [PLATFORM_ROLES.front_desk, PLATFORM_ROLES.admin],
  {
    userId: SELF.userId,
    name: 'Riya Shah',
    staffNumber: 12,
    phone: '+919825044120',
    branchIds: [ADAJAN.id, VESU.id],
  },
);
const REENAL = member('reenal', 'reenal@cresence.skin', PLATFORM_ROLES.doctor, {
  name: 'Dr. Reenal Chaniyara',
  staffNumber: 11,
  branchIds: [VESU.id],
});
const OWNER = member('owner', 'owner@clinic.com', PLATFORM_ROLES.owner, {
  name: 'Owen Owner',
  staffNumber: 1,
});
const INVITED = member('new', 'new@clinic.com', PLATFORM_ROLES.marketing, {
  status: 'invited',
  joinedAt: '',
  staffNumber: 13,
  invitation: { id: 'inv_new0000000000000000', expiresAt: IN_A_WEEK },
});

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.listMembers.mockResolvedValue({
    rows: [RIYA, REENAL, OWNER, INVITED],
    next: null,
    hasMore: false,
  });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
  api.fetchActiveBranches.mockResolvedValue([ADAJAN, VESU]);
});
afterEach(() => resetUsersRoutes());

/** The Team's rows on screen, once loaded. */
async function rows() {
  await waitFor(() =>
    expect(screen.getAllByTestId('users-team-table-row').length).toBeGreaterThan(0),
  );
  return screen.getAllByTestId('users-team-table-row');
}

const rowOf = async (name: string) => {
  const found = (await rows()).find((row) => within(row).queryByText(name));
  if (!found) throw new Error(`no row for ${name}`);
  return found;
};

describe('UsersPage — the Team', () => {
  it('renders the room — toolbar, tabs and table — every membership with its roles', async () => {
    const { container } = renderUsersRoutes('/organization/acme/users', UsersPage);
    expect(await screen.findByTestId('users-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument();
    expect(screen.getByTestId('users-team-table')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await rows()).toHaveLength(4);
    const riya = await rowOf('Riya Shah');
    expect(within(riya).getByText('#12')).toBeInTheDocument();
    expect(await within(riya).findByText('Front desk')).toBeInTheDocument();
    expect(within(riya).getByText('Admin')).toBeInTheDocument();
    expect(await within(riya).findByText('Vesu')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows no branch UI with one open branch: no Branches column, no Branches filter', async () => {
    api.fetchActiveBranches.mockResolvedValue([ADAJAN]);
    renderUsersRoutes('/organization/acme/users', UsersPage);
    // Riya works at Adajan and Vesu; with Adajan the only open branch, no chip shows.
    const riya = await rowOf('Riya Shah');
    await waitFor(() => expect(api.fetchActiveBranches).toHaveBeenCalled());
    expect(within(riya).queryByText('Adajan')).toBeNull();
    expect(within(riya).queryByText('Vesu')).toBeNull();
    screen.getByTestId('users-team-filters-trigger').click();
    const apply = await screen.findByTestId('users-team-filters-apply');
    const panel = apply.closest('[data-radix-popper-content-wrapper], [role="dialog"]');
    if (!(panel instanceof HTMLElement)) throw new Error('the Filters panel');
    expect(within(panel).getByText('Status')).toBeInTheDocument();
    expect(within(panel).queryByText('Branches')).toBeNull();
  });

  it('shows an invitation as "Invited" (its expiry is the Status cell’s, TeamCells)', async () => {
    renderUsersRoutes('/organization/acme/users', UsersPage);
    const invited = await rowOf('new@clinic.com');
    expect(within(invited).getByText('Invited')).toBeInTheDocument();
  });

  it('offers no Delete on your own row or the owner’s — your own row offers Leave clinic', async () => {
    renderUsersRoutes('/organization/acme/users', UsersPage);
    const self = await rowOf('Riya Shah');
    expect(within(self).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(self).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(
      within(self).getByRole('button', { name: 'Leave clinic' }),
    ).toBeInTheDocument();
    const owner = await rowOf('Owen Owner');
    expect(within(owner).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(owner).queryByRole('button', { name: 'Leave clinic' })).toBeNull();
    const doctor = await rowOf('Dr. Reenal Chaniyara');
    expect(within(doctor).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(doctor).queryByRole('button', { name: 'Leave clinic' })).toBeNull();
  });

  it('filters by the URL’s role — its id — and searches in place', async () => {
    renderUsersRoutes(
      `/organization/acme/users?role=${PLATFORM_ROLES.doctor.id}`,
      UsersPage,
    );
    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(screen.getByText('Dr. Reenal Chaniyara')).toBeInTheDocument();
  });

  it('searches name, email, mobile or #ID from the URL', async () => {
    renderUsersRoutes('/organization/acme/users?q=%2311', UsersPage);
    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(screen.getByText('Dr. Reenal Chaniyara')).toBeInTheDocument();
  });

  it('says "No user matches" when a search finds nobody', async () => {
    renderUsersRoutes('/organization/acme/users?q=nobody-here', UsersPage);
    expect(await screen.findByText('No user matches')).toBeInTheDocument();
  });

  it('offers "New user" with membership:create and role:read, never with one alone', async () => {
    const { unmount } = renderUsersRoutes('/organization/acme/users', UsersPage);
    expect(await screen.findByTestId('users-team-new-user')).toBeInTheDocument();
    unmount();
    resetUsersRoutes();

    renderUsersRoutes('/organization/acme/users', UsersPage, {
      codes: ['organization:read', 'membership:read', 'membership:create'],
    });
    await rows();
    expect(screen.queryByTestId('users-team-new-user')).toBeNull();
    // Without membership:delete no row can be deleted either.
    const doctor = await rowOf('Dr. Reenal Chaniyara');
    expect(within(doctor).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('exports the selected rows as CSV to whoever reads the Team', async () => {
    renderUsersRoutes('/organization/acme/users', UsersPage, {
      codes: ['organization:read', 'membership:read', 'role:read'],
    });
    fireEvent.click(within(await rowOf('Riya Shah')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('users-team-table-bulk-export'));
    expect(api.downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, content] = api.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('users.csv');
    expect(content).toContain('Riya Shah · +91');
  });

  it('opens the member drawer — by its membership id — on a row click', async () => {
    const { router } = renderUsersRoutes('/organization/acme/users', UsersPage);
    const doctor = await rowOf('Dr. Reenal Chaniyara');
    within(doctor).getByText('Dr. Reenal Chaniyara').click();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/users/${REENAL.id}/edit`,
      ),
    );
    expect(await screen.findByTestId('user-drawer')).toBeInTheDocument();
  });
});
