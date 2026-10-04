import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetClinicAccessFixture } from '@/shared/api/clinic/access-api.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { UsersPage } from '../../UsersPage.tsx';
import {
  member,
  PLATFORM_ROLES,
  renderUsersRoutes,
  resetUsersRoutes,
  SELF,
} from './users-test-router.tsx';

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

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  inviteMember: vi.fn(),
  updateMemberRole: vi.fn(),
  updateMemberStatus: vi.fn(),
  removeMember: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

const IN_A_WEEK = new Date(Date.now() + 7 * 86_400_000).toISOString();

const ROSTER = [
  member('riya', SELF.email, PLATFORM_ROLES.admin, { userId: SELF.userId }),
  member('reenal', 'reenal@cresence.skin'),
  member('new', 'new@clinic.com', PLATFORM_ROLES.member, {
    status: 'invited',
    joinedAt: '',
    invitation: { id: 'inv_new', expiresAt: IN_A_WEEK },
  }),
];

beforeEach(() => {
  viewport.tier = 'desktop';
  resetClinicFixtures();
  resetClinicAccessFixture();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  api.listMembers.mockResolvedValue({ rows: ROSTER, next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
  api.inviteMember.mockImplementation(({ email }: { email: string }) =>
    Promise.resolve(
      member('ishita', email, PLATFORM_ROLES.member, {
        status: 'invited',
        joinedAt: '',
        invitation: { id: 'inv_ishita', expiresAt: IN_A_WEEK },
      }),
    ),
  );
  api.updateMemberStatus.mockImplementation(
    ({
      membershipId,
      status,
    }: {
      membershipId: string;
      status: 'active' | 'suspended';
    }) => Promise.resolve({ ...ROSTER[1], id: membershipId, status }),
  );
  api.updateMemberRole.mockResolvedValue(ROSTER[1]);
  api.removeMember.mockResolvedValue(undefined);
  api.revokeInvitation.mockResolvedValue(undefined);
  api.resendInvitation.mockResolvedValue({ email: 'new@clinic.com' });
});
afterEach(() => {
  vi.useRealTimers();
  resetUsersRoutes();
  resetClinicFixtures();
  resetClinicAccessFixture();
});

/** The user drawer, once its form is up (the access and the Team resolved). */
async function drawer() {
  await screen.findByTestId('user-drawer-step-profile');
  return screen.getByTestId('user-drawer');
}

describe('Users › the user drawer (L-31b)', () => {
  it('invites a new user — least-privilege role while clinozy-be has no Front desk — and saves the profile', async () => {
    const user = userEvent.setup();
    const { router } = renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    expect(within(panel).getByText('New user')).toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();

    await user.type(within(panel).getByTestId('user-drawer-name'), 'Dr. Ishita Rao');
    await user.type(within(panel).getByTestId('user-drawer-email'), 'ishita@clinic.com');
    await user.click(within(panel).getByTestId('user-drawer-save'));

    await waitFor(() =>
      expect(api.inviteMember).toHaveBeenCalledWith({
        email: 'ishita@clinic.com',
        roleId: PLATFORM_ROLES.member.id,
      }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Dr. Ishita Rao added'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
    const profile = clinicFixtures.staff.snapshot(
      (row) => row.email === 'ishita@clinic.com',
    )[0];
    expect(profile?.membershipId).toBe('mbr_ishita');
    expect(profile?.roleKeys).toEqual(['front_desk']);
  });

  it('takes Admin as the membership’s role when Admin is picked', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    await user.type(within(panel).getByTestId('user-drawer-name'), 'Kavya Mehta');
    await user.type(within(panel).getByTestId('user-drawer-email'), 'kavya@clinic.com');
    await user.click(within(panel).getByTestId('user-drawer-roles-admin'));
    await user.click(within(panel).getByTestId('user-drawer-save'));
    await waitFor(() =>
      expect(api.inviteMember).toHaveBeenCalledWith({
        email: 'kavya@clinic.com',
        roleId: PLATFORM_ROLES.admin.id,
      }),
    );
  });

  it('stops on step 1 with "Add name and email" while either is empty', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    await user.click(within(panel).getByTestId('user-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add name and email');
    expect(api.inviteMember).not.toHaveBeenCalled();
  });

  it('refuses an email that does not read as one, and a short mobile', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    await user.type(within(panel).getByTestId('user-drawer-name'), 'Kavya');
    await user.type(within(panel).getByTestId('user-drawer-email'), 'kavya-at-clinic');
    await user.click(within(panel).getByTestId('user-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter a valid email address');

    await user.clear(within(panel).getByTestId('user-drawer-email'));
    await user.type(within(panel).getByTestId('user-drawer-email'), 'kavya@clinic.com');
    await user.type(within(panel).getByTestId('user-drawer-mobile'), '98250');
    await user.click(within(panel).getByTestId('user-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Mobile needs 10 digits');
    expect(api.inviteMember).not.toHaveBeenCalled();
  });

  it('edits a member: Inactive suspends the membership, then "<name> saved"', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/mbr_reenal/edit', UsersPage);
    const panel = await drawer();
    expect(within(panel).getByText('Edit user')).toBeInTheDocument();
    expect(within(panel).getByTestId('user-drawer-tag')).toHaveTextContent('#11');
    await user.click(await within(panel).findByTestId('user-drawer-step-hours-trigger'));
    await user.click(within(panel).getByTestId('user-drawer-status'));
    await user.click(within(panel).getByTestId('user-drawer-save'));
    await waitFor(() =>
      expect(api.updateMemberStatus).toHaveBeenCalledWith({
        membershipId: 'mbr_reenal',
        status: 'suspended',
      }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Dr. Reenal Chaniyara saved'),
    );
    expect(api.updateMemberRole).not.toHaveBeenCalled();
  });

  it('keeps your own status out of reach', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/mbr_riya/edit', UsersPage);
    const panel = await drawer();
    await user.click(await within(panel).findByTestId('user-drawer-step-hours-trigger'));
    expect(within(panel).getByTestId('user-drawer-status')).toBeDisabled();
    expect(within(panel).queryByTestId('user-drawer-delete')).toBeNull();
  });

  it('shows an invited member’s expiry with "Resend invitation"', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/mbr_new/edit', UsersPage);
    const panel = await drawer();
    await user.click(await within(panel).findByTestId('user-drawer-step-hours-trigger'));
    expect(within(panel).getByTestId('user-drawer-invitation')).toHaveTextContent(
      /^Invitation expires /,
    );
    await user.click(within(panel).getByTestId('user-drawer-resend'));
    await waitFor(() => expect(api.resendInvitation).toHaveBeenCalledWith('inv_new'));
  });

  it('is view only without membership:manage', async () => {
    renderUsersRoutes('/organization/acme/users/mbr_reenal/edit', UsersPage, {
      codes: ['organization:read', 'membership:read', 'role:read'],
    });
    const panel = await drawer();
    expect(within(panel).queryByTestId('user-drawer-save')).toBeNull();
    expect(
      within(panel).getByText('View only · your role can’t change this'),
    ).toBeVisible();
  });

  it('lands back on the Team with "User not found" for a member id it doesn’t have', async () => {
    const { router } = renderUsersRoutes(
      '/organization/acme/users/mbr_gone/edit',
      UsersPage,
    );
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith(
        'User not found · it may have been deleted',
      ),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
  });

  it('sends a create link back with the permission toast to a member who may not invite', async () => {
    const { router } = renderUsersRoutes('/organization/acme/users/create', UsersPage, {
      codes: ['organization:read', 'membership:read', 'role:read', 'invitation:manage'],
    });
    await waitFor(() => expect(notifyMock.info).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
    expect(screen.queryByTestId('user-drawer')).toBeNull();
  });
});

describe('Users › removing a member (deferred, with Undo)', () => {
  async function confirmDelete(name: string) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderUsersRoutes('/organization/acme/users', UsersPage);
    await waitFor(() =>
      expect(screen.getAllByTestId('users-team-table-row')).toHaveLength(3),
    );
    const row = screen
      .getAllByTestId('users-team-table-row')
      .find((candidate) => within(candidate).queryByText(name));
    if (!row) throw new Error(`no row for ${name}`);
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this user?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(name);
    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    return user;
  }

  it('takes the row away at once and removes the membership only after the 10s Undo window', async () => {
    await confirmDelete('Dr. Reenal Chaniyara');
    await waitFor(() =>
      expect(screen.getAllByTestId('users-team-table-row')).toHaveLength(2),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Dr. Reenal Chaniyara removed',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
    );
    expect(api.removeMember).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('mbr_reenal'));
    const profile = clinicFixtures.staff.snapshot((row) => row.seq === 11)[0];
    expect(profile).toBeUndefined();
  });

  it('puts the row back on Undo and never removes the membership', async () => {
    await confirmDelete('Dr. Reenal Chaniyara');
    await waitFor(() =>
      expect(screen.getAllByTestId('users-team-table-row')).toHaveLength(2),
    );
    const [, options] = notifyMock.success.mock.calls.find(
      ([message]) => message === 'Dr. Reenal Chaniyara removed',
    ) as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    await waitFor(() =>
      expect(screen.getAllByTestId('users-team-table-row')).toHaveLength(3),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.removeMember).not.toHaveBeenCalled();
  });

  it('cancels an invitation instead of removing a membership', async () => {
    await confirmDelete('new@clinic.com');
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith('inv_new'));
    expect(api.removeMember).not.toHaveBeenCalled();
  });
});
