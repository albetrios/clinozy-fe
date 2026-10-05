import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import {
  member,
  PLATFORM_ROLES,
  renderUsersRoutes,
  resetUsersRoutes,
  SELF,
  USERS_ADMIN_CODES,
} from '../__tests__/integration/users-test-router.tsx';
import { BranchesPage } from './BranchesPage.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
// The module itself, not the barrel: the deferred commit imports it directly.
vi.mock('@/shared/notify/notify.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const api = vi.hoisted(() => ({ listMembers: vi.fn(), listRoles: vi.fn() }));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

const ROSTER = [
  member('riya', SELF.email, PLATFORM_ROLES.admin, { userId: SELF.userId }),
  member('reenal', 'reenal@cresence.skin'),
  member('nisha', 'nisha@cresence.skin', PLATFORM_ROLES.admin),
];

/** The list's rows, once they are in. */
async function rows() {
  await waitFor(() =>
    expect(screen.getAllByTestId('users-branches-table-row')).toHaveLength(3),
  );
  return screen.getAllByTestId('users-branches-table-row');
}

function renderBranches(
  url = '/organization/acme/users/branches',
  codes = USERS_ADMIN_CODES,
) {
  return renderUsersRoutes(url, () => null, { codes, Branches: BranchesPage });
}

beforeEach(() => {
  viewport.tier = 'desktop';
  resetClinicFixtures();
  resetClinicAccessFixture();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  api.listMembers.mockResolvedValue({ rows: ROSTER, next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
});
afterEach(() => {
  vi.useRealTimers();
  resetUsersRoutes();
  resetClinicFixtures();
  resetClinicAccessFixture();
});

describe('Users › Branches (users.md:79–95)', () => {
  it('lists every branch, the main one first with "Main", each with its address, contact and hours', async () => {
    const { container } = renderBranches();
    const [adajan, vesu] = await rows();
    if (!(adajan && vesu)) throw new Error('two rows');
    expect(within(adajan).getByText('Adajan')).toBeInTheDocument();
    expect(within(adajan).getByText('Main')).toBeInTheDocument();
    expect(within(adajan).getByText('3rd floor, Shree Hari Complex')).toBeInTheDocument();
    expect(
      within(adajan).getByText('Near Star Bazaar, Adajan Gam Road, Adajan, Surat 395009'),
    ).toBeInTheDocument();
    expect(within(adajan).getByText('+91 74900 20099')).toBeInTheDocument();
    expect(within(adajan).getByText('Mon–Sat · 10:00–20:00')).toBeInTheDocument();
    expect(within(adajan).getByText('Open')).toBeInTheDocument();
    expect(within(vesu).getByText('Tue–Sun · 11:00–20:00')).toBeInTheDocument();
    // The Team who work there and the default people the Team has.
    expect(within(adajan).getByText('Riya S.')).toBeInTheDocument();
    // The member's name isolated beside the role.
    expect(
      within(adajan).getByText(`Doctor · ${fsi('Dr. Nisha Mavani')}`),
    ).toBeInTheDocument();
    expect(screen.getByText('All branches loaded')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('lists a closed branch as "Closed" and never offers Delete on the main branch', async () => {
    const vesu = clinicFixtures.branches.snapshot((branch) => branch.name === 'Vesu')[0];
    if (!vesu) throw new Error('Vesu');
    await clinicFixtures.branches.update(vesu.id, { active: false });
    renderBranches();
    const [adajan, vesuRow] = await rows();
    if (!(adajan && vesuRow)) throw new Error('two rows');
    expect(within(vesuRow).getByText('Closed')).toBeInTheDocument();
    expect(within(adajan).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(vesuRow).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('opens a branch’s drawer from its row, and New branch from the toolbar', async () => {
    const user = userEvent.setup();
    const { router } = renderBranches();
    const [adajan] = await rows();
    if (!adajan) throw new Error('a row');
    await user.click(adajan);
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(
        /^\/organization\/acme\/users\/branches\/[^/]+\/edit$/,
      ),
    );
    expect(await screen.findByTestId('branch-drawer')).toBeInTheDocument();
    expect(await screen.findByTestId('branch-drawer-name')).toHaveValue('Adajan');
    await user.click(screen.getByTestId('branch-drawer-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users/branches'),
    );
    await user.click(screen.getByTestId('users-branches-new-branch'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/users/branches/create',
      ),
    );
  });

  it('filters by Created, with the filtered empty state', async () => {
    renderBranches('/organization/acme/users/branches?created=today');
    expect(await screen.findByText('Clear filters')).toBeInTheDocument();
    expect(screen.queryAllByTestId('users-branches-table-row')).toHaveLength(0);
  });

  it('removes a branch only after the 10s Undo window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBranches();
    const [, vesu] = await rows();
    if (!vesu) throw new Error('Vesu');
    await user.click(within(vesu).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this branch?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('Vesu');
    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(screen.getAllByTestId('users-branches-table-row')).toHaveLength(2),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Vesu removed',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
    );
    expect(clinicFixtures.branches.snapshot()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(clinicFixtures.branches.snapshot()).toHaveLength(2));
  });

  it('offers no "New branch" and no Delete without the Users row’s rights', async () => {
    renderBranches('/organization/acme/users/branches', [
      'organization:read',
      'membership:read',
      'role:read',
    ]);
    const [, vesu] = await rows();
    if (!vesu) throw new Error('Vesu');
    expect(screen.queryByTestId('users-branches-new-branch')).toBeNull();
    expect(within(vesu).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('sends a create link back with the permission toast to a viewer who may not create', async () => {
    const { router } = renderBranches('/organization/acme/users/branches/create', [
      'organization:read',
      'membership:read',
    ]);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users/branches'),
    );
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });

  it('leaves a dead branch link with "Branch not found"', async () => {
    const { router } = renderBranches(
      '/organization/acme/users/branches/00000000-0000-4000-8000-000000000000/edit',
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users/branches'),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Branch not found · it may have been deleted',
    );
  });

  it('puts the chip first and the address block, with the rest, at the end on a phone', async () => {
    viewport.tier = 'phone';
    renderBranches();
    const [adajan] = await rows();
    if (!adajan) throw new Error('a row');
    const [chip, address] = within(adajan).getAllByRole('cell');
    expect(chip).toHaveTextContent('AdajanMain');
    expect(address).toHaveTextContent('3rd floor, Shree Hari Complex');
    expect(address).toHaveTextContent('Contact');
    expect(address).toHaveTextContent('Opening hours');
  });
});
