import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type * as BranchesApiModule from '@/shared/api/clinic/branches-api.ts';
import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { MemberInvite } from '@/shared/api/organization-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { UsersPage } from '../../UsersPage.tsx';
import {
  member,
  PLATFORM_ROLES,
  renderUsersRoutes,
  resetUsersRoutes,
  SELF,
  USERS_ADMIN_CODES,
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
  updateMember: vi.fn(),
  removeMember: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  getRolePermissions: vi.fn(),
  leaveOrganization: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));
const branchesApi = vi.hoisted(() => ({ fetchActiveBranches: vi.fn() }));
vi.mock('@/shared/api/clinic/branches-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesApiModule>()),
  ...branchesApi,
}));
// The clinic's name, as me/context reports the active organisation.
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: { activeOrganization: { name: 'Cresence Skin' } } }),
}));

const IN_A_WEEK = new Date(Date.now() + 7 * 86_400_000).toISOString();

/** The clinic's one open branch: every user is saved on it. */
const ADAJAN: BranchOption = {
  id: 'brn_adajan000000000000000',
  name: 'Adajan',
  tone: 'mint',
  isMain: true,
  opensAt: '10:00',
  closesAt: '19:00',
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

const RIYA = member('riya', SELF.email, PLATFORM_ROLES.admin, {
  userId: SELF.userId,
  name: 'Riya Shah',
  staffNumber: 12,
});
const REENAL = member('reenal', 'reenal@cresence.skin', PLATFORM_ROLES.doctor, {
  name: 'Dr. Reenal Chaniyara',
  staffNumber: 11,
  branchIds: ['brn_adajan000000000000000'],
});
const INVITED = member('new', 'new@clinic.com', PLATFORM_ROLES.marketing, {
  status: 'invited',
  joinedAt: '',
  staffNumber: 13,
  invitation: { id: 'inv_new0000000000000000', expiresAt: IN_A_WEEK },
});
const ROSTER = [RIYA, REENAL, INVITED];

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of [
    ...Object.values(notifyMock),
    ...Object.values(api),
    ...Object.values(branchesApi),
  ]) {
    fn.mockReset();
  }
  api.listMembers.mockResolvedValue({ rows: ROSTER, next: null, hasMore: false });
  api.listRoles.mockResolvedValue({
    rows: Object.values(PLATFORM_ROLES),
    next: null,
    hasMore: false,
  });
  branchesApi.fetchActiveBranches.mockResolvedValue([ADAJAN]);
  api.getRolePermissions.mockResolvedValue(['organization:read']);
  api.inviteMember.mockImplementation(({ invite }: { invite: MemberInvite }) =>
    Promise.resolve(
      member('ishita', invite.email, PLATFORM_ROLES.front_desk, {
        status: 'invited',
        joinedAt: '',
        invitation: { id: 'inv_ishita00000000000000', expiresAt: IN_A_WEEK },
      }),
    ),
  );
  api.updateMember.mockImplementation(({ membershipId }: { membershipId: string }) =>
    Promise.resolve({ ...REENAL, id: membershipId, status: 'suspended' }),
  );
  api.removeMember.mockImplementation(({ membershipId }: { membershipId: string }) =>
    Promise.resolve({ id: membershipId }),
  );
  api.revokeInvitation.mockImplementation((membershipId: string) =>
    Promise.resolve({ id: membershipId }),
  );
  api.resendInvitation.mockResolvedValue({ email: INVITED.email, expiresAt: IN_A_WEEK });
  api.leaveOrganization.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  resetUsersRoutes();
});

/** The user drawer, once its form is up (the access and the Team resolved). */
async function drawer() {
  await screen.findByTestId('user-drawer-step-profile');
  return screen.getByTestId('user-drawer');
}

/** The invitation clinozy-be was sent. */
function sentInvite(): MemberInvite {
  expect(api.inviteMember).toHaveBeenCalledTimes(1);
  const [call] = api.inviteMember.mock.calls[0] as [{ invite: MemberInvite }];
  return call.invite;
}

describe('Users › the user drawer (L-31b)', () => {
  it('invites a new user by email — Front desk, on the one open branch — then "<email> added"', async () => {
    const user = userEvent.setup();
    const { router } = renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    expect(within(panel).getByText('New user')).toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();

    await user.type(within(panel).getByTestId('user-drawer-email'), 'ishita@clinic.com');
    await user.click(within(panel).getByTestId('user-drawer-save'));

    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('ishita@clinic.com added'),
    );
    expect(sentInvite()).toMatchObject({
      email: 'ishita@clinic.com',
      roleIds: [PLATFORM_ROLES.front_desk.id],
      branchIds: [ADAJAN.id],
    });
    const [call] = api.inviteMember.mock.calls[0] as [{ idempotencyKey?: string }];
    expect(call.idempotencyKey).toEqual(expect.any(String));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
  });

  it('sends every role picked, the first as the main one', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    await user.type(within(panel).getByTestId('user-drawer-email'), 'kavya@clinic.com');
    await user.click(
      within(panel).getByTestId(`user-drawer-roles-${PLATFORM_ROLES.admin.id}`),
    );
    await user.click(within(panel).getByTestId('user-drawer-save'));
    await waitFor(() => expect(api.inviteMember).toHaveBeenCalledTimes(1));
    expect(sentInvite().roleIds).toEqual([
      PLATFORM_ROLES.front_desk.id,
      PLATFORM_ROLES.admin.id,
    ]);
  });

  it('stops on step 1 with "Add their email" while it is empty', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    await user.click(within(panel).getByTestId('user-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add their email');
    expect(api.inviteMember).not.toHaveBeenCalled();
  });

  it('refuses an email that does not read as one, and a short mobile', async () => {
    const user = userEvent.setup();
    renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
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

  it('outlines Email when the person is already in the clinic (409)', async () => {
    const user = userEvent.setup();
    api.inviteMember.mockRejectedValue(
      new HttpError('Conflict', 409, '/tenancy/organization/memberships', 'POST', {
        error: {
          reason: 'membership_already_exists',
          detail: 'Already a member',
        },
      }),
    );
    renderUsersRoutes('/organization/acme/users/create', UsersPage);
    const panel = await drawer();
    await user.type(within(panel).getByTestId('user-drawer-email'), REENAL.email);
    await user.click(within(panel).getByTestId('user-drawer-save'));
    await waitFor(() => expect(notifyMock.warning).toHaveBeenCalledTimes(1));
    expect(within(panel).getByTestId('user-drawer-email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('edits a member: Inactive suspends the membership, with the read’s updated_at', async () => {
    const user = userEvent.setup();
    renderUsersRoutes(`/organization/acme/users/${REENAL.id}/edit`, UsersPage);
    const panel = await drawer();
    expect(within(panel).getByText('Edit user')).toBeInTheDocument();
    expect(within(panel).getByTestId('user-drawer-tag')).toHaveTextContent('#11');
    await user.click(await within(panel).findByTestId('user-drawer-step-hours-trigger'));
    await user.click(within(panel).getByTestId('user-drawer-status'));
    await user.click(within(panel).getByTestId('user-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Dr. Reenal Chaniyara saved'),
    );
    expect(api.updateMember).toHaveBeenCalledWith({
      membershipId: REENAL.id,
      change: { status: 'suspended', expectedUpdatedAt: REENAL.updatedAt },
      idempotencyKey: expect.any(String),
    });
  });

  it('keeps your own status out of reach', async () => {
    const user = userEvent.setup();
    renderUsersRoutes(`/organization/acme/users/${RIYA.id}/edit`, UsersPage);
    const panel = await drawer();
    await user.click(await within(panel).findByTestId('user-drawer-step-hours-trigger'));
    expect(within(panel).getByTestId('user-drawer-status')).toBeDisabled();
    // Its destructive button is Leave clinic, never Delete.
    expect(within(panel).getByTestId('user-drawer-delete')).toHaveTextContent(
      'Leave clinic',
    );
  });

  it('shows an invited member’s expiry with "Resend invitation", sent by the membership', async () => {
    const user = userEvent.setup();
    renderUsersRoutes(`/organization/acme/users/${INVITED.id}/edit`, UsersPage);
    const panel = await drawer();
    await user.click(await within(panel).findByTestId('user-drawer-step-hours-trigger'));
    expect(within(panel).getByTestId('user-drawer-invitation')).toHaveTextContent(
      /^Invitation expires /,
    );
    await user.click(within(panel).getByTestId('user-drawer-resend'));
    await waitFor(() =>
      expect(api.resendInvitation).toHaveBeenCalledWith(INVITED.id, expect.any(String)),
    );
  });

  it('is view only without membership:update', async () => {
    renderUsersRoutes(`/organization/acme/users/${REENAL.id}/edit`, UsersPage, {
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
      '/organization/acme/users/mem_gone00000000000000000/edit',
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
      codes: ['organization:read', 'membership:read', 'membership:create'],
    });
    await waitFor(() => expect(notifyMock.info).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
    expect(screen.queryByTestId('user-drawer')).toBeNull();
  });
});

describe('Users › a member opened from Roles & access (H:5188)', () => {
  it('keeps the role page behind the drawer and returns to it on close', async () => {
    const user = userEvent.setup();
    const role = PLATFORM_ROLES.doctor.id;
    const { router } = renderUsersRoutes(
      `/organization/acme/users/${REENAL.id}/edit?from=roles&role=${role}`,
      UsersPage,
    );
    const panel = await drawer();
    expect(screen.getByTestId('users-roles-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('users-team-table')).toBeNull();
    // Behind the modal drawer, so out of the accessibility tree.
    expect(
      screen.getByRole('link', { name: 'Roles & access', hidden: true }),
    ).toHaveAttribute('aria-current', 'page');
    await user.click(within(panel).getByTestId('user-drawer-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users/roles'),
    );
    expect(router.state.location.search).toEqual({ role });
  });
});

describe('Users › removing a member (deferred, with Undo)', () => {
  async function confirmDelete(name: string, codes = USERS_ADMIN_CODES) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderUsersRoutes('/organization/acme/users', UsersPage, { codes });
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

  it('takes the row away at once and removes the membership — with the reason — only after the 10s Undo window', async () => {
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
    await waitFor(() =>
      expect(api.removeMember).toHaveBeenCalledWith({
        membershipId: REENAL.id,
        reason: 'not_needed',
        note: undefined,
      }),
    );
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

  it('deletes from the drawer too: it closes, and the membership goes after the window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { router } = renderUsersRoutes(
      `/organization/acme/users/${REENAL.id}/edit`,
      UsersPage,
    );
    const panel = await drawer();
    await user.click(within(panel).getByTestId('user-drawer-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this user?')).toBeInTheDocument();
    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Dr. Reenal Chaniyara removed',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() =>
      expect(api.removeMember).toHaveBeenCalledWith(
        expect.objectContaining({ membershipId: REENAL.id }),
      ),
    );
    // The drawer closing never takes the delete back ("Action cancelled").
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('cancels an invitation — by the membership — instead of removing a membership', async () => {
    await confirmDelete('new@clinic.com');
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith(INVITED.id));
    expect(api.removeMember).not.toHaveBeenCalled();
  });

  it('offers Delete on no row without membership:delete', async () => {
    const codes: OrganizationPermission[] = USERS_ADMIN_CODES.filter(
      (held) => held !== 'membership:delete',
    );
    renderUsersRoutes('/organization/acme/users', UsersPage, { codes });
    await waitFor(() =>
      expect(screen.getAllByTestId('users-team-table-row')).toHaveLength(3),
    );
    for (const row of screen.getAllByTestId('users-team-table-row')) {
      expect(within(row).queryByRole('button', { name: 'Delete' })).toBeNull();
    }
  });
});

describe('Users › leave the clinic (D17 — Settings’ self-removal)', () => {
  /** The Team's row for `name`, once the Team is up. */
  async function rowFor(name: string) {
    await waitFor(() =>
      expect(screen.getAllByTestId('users-team-table-row')).toHaveLength(3),
    );
    const row = screen
      .getAllByTestId('users-team-table-row')
      .find((candidate) => within(candidate).queryByText(name));
    if (!row) throw new Error(`no row for ${name}`);
    return row;
  }

  it('leaves from your own row after the 10s Undo window, then lands on your clinics', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { router } = renderUsersRoutes('/organization/acme/users', UsersPage);
    const own = await rowFor('Riya Shah');
    await user.click(within(own).getByRole('button', { name: 'Leave clinic' }));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Leave Cresence Skin?')).toBeInTheDocument();
    expect(await axeForDialog(dialog)).toHaveNoViolations();
    await user.click(within(dialog).getByTestId('confirm-accept'));

    await waitFor(() =>
      expect(screen.getAllByTestId('users-team-table-row')).toHaveLength(2),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Leaving Cresence Skin…',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
    );
    expect(api.leaveOrganization).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(api.leaveOrganization).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.state.location.pathname).toBe('/organization'));
    expect(api.removeMember).not.toHaveBeenCalled();
  });

  it('offers it in Delete’s place on your own drawer', async () => {
    const user = userEvent.setup();
    renderUsersRoutes(`/organization/acme/users/${RIYA.id}/edit`, UsersPage);
    const panel = await drawer();
    await user.click(within(panel).getByTestId('user-drawer-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Leave Cresence Skin?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(api.leaveOrganization).not.toHaveBeenCalled();
  });

  it('leaves from your own drawer too: it closes, and the leave lands after the window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { router } = renderUsersRoutes(
      `/organization/acme/users/${RIYA.id}/edit`,
      UsersPage,
    );
    const panel = await drawer();
    await user.click(within(panel).getByTestId('user-drawer-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/users'),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(api.leaveOrganization).toHaveBeenCalledTimes(1));
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('never offers it to the owner — clinozy-be makes them transfer ownership first', async () => {
    api.listMembers.mockResolvedValue({
      rows: [
        member('riya', SELF.email, PLATFORM_ROLES.owner, {
          userId: SELF.userId,
          name: 'Riya Shah',
        }),
        REENAL,
        INVITED,
      ],
      next: null,
      hasMore: false,
    });
    renderUsersRoutes(`/organization/acme/users/${RIYA.id}/edit`, UsersPage);
    const panel = await drawer();
    expect(within(panel).queryByTestId('user-drawer-delete')).toBeNull();
    const own = await rowFor('Riya Shah');
    expect(within(own).queryByRole('button', { name: 'Leave clinic' })).toBeNull();
  });
});
