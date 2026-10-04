import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';

import {
  member,
  PLATFORM_ROLES,
  renderUsersRoutes,
  resetUsersRoutes,
  SELF,
} from './__tests__/integration/users-test-router.tsx';
import { UsersPage } from './UsersPage.tsx';

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  listMembers: api.listMembers,
  listRoles: api.listRoles,
}));

const IN_A_WEEK = new Date(Date.now() + 7 * 86_400_000).toISOString();

/** The roster: you (Riya, an Admin), a doctor, the owner and an invitation. */
const ROSTER = [
  member('riya', SELF.email, PLATFORM_ROLES.admin, { userId: SELF.userId }),
  member('reenal', 'reenal@cresence.skin'),
  member('owner', 'owner@clinic.com', PLATFORM_ROLES.owner, { name: 'Owen Owner' }),
  member('new', 'new@clinic.com', PLATFORM_ROLES.member, {
    status: 'invited',
    joinedAt: '',
    invitation: { id: 'inv_new', expiresAt: IN_A_WEEK },
  }),
];

beforeEach(() => {
  resetClinicFixtures();
  resetClinicAccessFixture();
  api.listMembers.mockResolvedValue({ rows: ROSTER, next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
});
afterEach(() => {
  resetUsersRoutes();
  resetClinicFixtures();
  resetClinicAccessFixture();
});

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
  it('renders the room — toolbar, tabs and table — with every member joined to their profile', async () => {
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
    expect(within(riya).getByText('Front desk')).toBeInTheDocument();
    expect(within(riya).getByText('Admin')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows no branch UI with one open branch: no Branches column, no Branches filter', async () => {
    for (const branch of clinicFixtures.branches.snapshot((row) => !row.isMain)) {
      await clinicFixtures.branches.update(branch.id, { active: false });
    }
    renderUsersRoutes('/organization/acme/users', UsersPage);
    // Riya works at Adajan and Vesu; with Adajan the only open branch, no chip shows.
    const riya = await rowOf('Riya Shah');
    expect(within(riya).queryByText('Adajan')).toBeNull();
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

  it('filters by the URL’s role and searches in place', async () => {
    renderUsersRoutes('/organization/acme/users?role=doctor', UsersPage);
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

  it('offers "New user" with invitation:manage and membership:manage, never with one alone (D47)', async () => {
    const { unmount } = renderUsersRoutes('/organization/acme/users', UsersPage);
    expect(await screen.findByTestId('users-team-new-user')).toBeInTheDocument();
    unmount();
    resetUsersRoutes();

    renderUsersRoutes('/organization/acme/users', UsersPage, {
      codes: ['organization:read', 'membership:read', 'role:read', 'invitation:manage'],
    });
    await rows();
    expect(screen.queryByTestId('users-team-new-user')).toBeNull();
    // Without membership:manage no row can be deleted either.
    const doctor = await rowOf('Dr. Reenal Chaniyara');
    expect(within(doctor).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('opens the member drawer on a row click', async () => {
    const { router } = renderUsersRoutes('/organization/acme/users', UsersPage);
    const doctor = await rowOf('Dr. Reenal Chaniyara');
    within(doctor).getByText('Dr. Reenal Chaniyara').click();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/users/mbr_reenal/edit',
      ),
    );
    expect(await screen.findByTestId('user-drawer')).toBeInTheDocument();
  });
});
