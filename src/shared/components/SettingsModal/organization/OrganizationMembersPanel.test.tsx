import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import type * as UsersRoomLinkModule from './UsersRoomLink.tsx';

/**
 * The panel schedules its deferred removal through the query cache now, so it
 * needs a client. Kept local (rather than renderWithProviders) so these stay
 * router-free component tests.
 */
function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const {
  useMembersMock,
  removeMutate,
  removeMutateSync,
  removeMemberOptions,
  updateMemberMutate,
  rowMenuCrash,
  usePlatformRolesMock,
} = vi.hoisted(() => ({
  useMembersMock: vi.fn(),
  /** `mutateAsync` — the only removal entry point the panel may use. */
  removeMutate: vi.fn(),
  /** `mutate` — kept separate so a regression to the void-returning call shows. */
  removeMutateSync: vi.fn(),
  /** Every options object `useRemoveMember` was constructed with. */
  removeMemberOptions: [] as (Record<string, unknown> | undefined)[],
  updateMemberMutate: vi.fn(),
  /** When set, the row menu's write hook throws — a crash inside one row. */
  rowMenuCrash: { current: false },
  usePlatformRolesMock: vi.fn(),
}));
vi.mock('@/shared/hooks/useMembers/index.ts', async () => {
  const { useState } = await import('react');
  return {
    useMembers: useMembersMock,
    useRemoveMember: (options?: Record<string, unknown>) => {
      removeMemberOptions.push(options);
      return { mutate: removeMutateSync, mutateAsync: removeMutate };
    },
    // Real pending state: the flag is the subject of the SET-12 tests below.
    useUpdateMember: () => {
      const [isPending, setIsPending] = useState(false);
      if (rowMenuCrash.current) throw new Error('row menu exploded');
      return {
        isPending,
        mutate: (vars: unknown) => {
          updateMemberMutate(vars);
          setIsPending(true);
        },
      };
    },
  };
});
vi.mock('@/shared/hooks/useTeam/index.ts', () => ({
  usePlatformRoles: usePlatformRolesMock,
}));
const { resendMutate, revokeMutateAsync, revokeInvitationOptions } = vi.hoisted(() => ({
  resendMutate: vi.fn(),
  /** `mutateAsync` — the deferred commit has to await the revoke, as it does a removal. */
  revokeMutateAsync: vi.fn(),
  /** Every options object `useRevokeInvitation` was constructed with. */
  revokeInvitationOptions: [] as (Record<string, unknown> | undefined)[],
}));
vi.mock('@/shared/hooks/useInvitations/index.ts', () => ({
  useResendInvitation: () => ({ isPending: false, mutate: resendMutate }),
  useRevokeInvitation: (options?: Record<string, unknown>) => {
    revokeInvitationOptions.push(options);
    return { mutateAsync: revokeMutateAsync };
  },
}));
// The Users room's link has its own suite; here only which surface the panel shows.
vi.mock('./UsersRoomLink.tsx', async (importOriginal) => ({
  ...(await importOriginal<typeof UsersRoomLinkModule>()),
  UsersRoomLink: ({ section }: { section: string }) => (
    <p data-testid={`users-room-link-${section}`}>{section}</p>
  ),
}));
vi.mock('@/shared/components/InviteMemberDialog/index.ts', () => ({
  InviteMemberDialog: () => (
    <button type="button" data-testid="invite-member-open">
      Invite member
    </button>
  ),
}));
/**
 * Each scheduled commit, with the promise `onCommit()` handed back. The real
 * helper is what turns that promise into "committed" or `onCommitError`, so
 * whether the panel's write is actually inside it is the thing to assert.
 */
const deferredCommits = vi.hoisted(
  () => [] as { onCommit: () => void | Promise<void>; commit: Promise<unknown> }[],
);
vi.mock('@/shared/notify/notify-deferred.ts', () => ({
  // Commit immediately and hand back the real handle shape the caller stores.
  notifyDeferredCommit: (options: { onCommit: () => void | Promise<void> }) => {
    const commit = Promise.resolve(options.onCommit());
    // The real helper routes a rejection to `onCommitError`; keep it handled
    // here so tests can assert on `commit` without an unhandled rejection.
    commit.catch(() => undefined);
    deferredCommits.push({ onCommit: options.onCommit, commit });
    return { cancel: vi.fn(), flush: vi.fn() };
  },
}));

import { OrganizationMembersPanel } from './OrganizationMembersPanel.tsx';

/** The most recently scheduled deferred commit. */
const lastDeferred = () => {
  const call = deferredCommits.at(-1);
  if (!call) throw new Error('no deferred commit was scheduled');
  return call;
};
/** Let queued microtasks run without advancing any timer. */
const flushMicrotasks = () => act(async () => undefined);

const OWNER = {
  id: 'mem_owner',
  userId: 'usr_owner',
  name: 'Ada Byron',
  email: 'ada@acme.test',
  roleIds: ['rol_owner'],
  roleId: 'rol_owner',
  isOwner: true,
  status: 'active',
  joinedAt: '2026-01-01T00:00:00.000Z',
};
const MEMBER = {
  id: 'mem_1',
  userId: 'usr_1',
  name: 'Jo Rivera',
  email: 'jo@acme.test',
  roleIds: ['rol_member', 'rol_extra'],
  roleId: 'rol_member',
  isOwner: false,
  status: 'active',
  joinedAt: '2026-02-01T00:00:00.000Z',
};
const INVITED = {
  ...MEMBER,
  id: 'mem_inv',
  name: 'Sam Pending',
  email: 'sam@acme.test',
  status: 'invited',
  joinedAt: '', // never joined
};
/** An invited row as clinozy-be reports it: the membership plus its live invitation. */
const PENDING_INVITE = {
  ...INVITED,
  invitation: { id: 'inv_aaaaaaaaaaaaaaaaaaaaa', expiresAt: '2099-01-01T00:00:00.000Z' },
};
/** An invitation whose link has lapsed — a resend sends a fresh one. */
const EXPIRED_INVITE = {
  ...INVITED,
  id: 'mem_lapsed',
  name: 'Lee Lapsed',
  email: 'lee@acme.test',
  invitation: { id: 'inv_bbbbbbbbbbbbbbbbbbbbb', expiresAt: '2020-01-01T00:00:00.000Z' },
};

function role(id: string, name: string): RoleSummary {
  return {
    id,
    name,
    description: '',
    permissions: [],
    memberCount: 0,
    isSystem: name === 'Owner',
    isLocked: false,
    tone: 'sky',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function membersQueryResult(
  overrides: { rows?: (typeof MEMBER)[] } & Record<string, unknown>,
) {
  return {
    rows: overrides.rows ?? [],
    isPending: false,
    isError: false,
    isFetching: false,
    isRefreshing: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

function rolesResult(roles: RoleSummary[]) {
  return { roles, isPending: false, isError: false, error: null, refetch: vi.fn() };
}

function setCanManage(value: boolean) {
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.test', role: 'user' },
    isAuthenticated: true,
  });
  useOrganizationStore.setState({
    organizationType: value ? 'TEAM' : 'PERSONAL',
    // Invite calls `POST .../memberships` (`membership:create`) and its dialog needs the
    // roles list (`role:read`); edits are `membership:update`, removal `membership:delete`.
    permissions: value
      ? ['membership:create', 'membership:update', 'membership:delete', 'role:read']
      : [],
    // A session whose guard chain has ANSWERED — the unresolved case is its own
    // test below (SET-23).
    permissionsResolved: true,
  });
}

/** A resolved TEAM session holding exactly these permissions. */
function setPermissions(permissions: OrganizationPermission[]) {
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.test', role: 'user' },
    isAuthenticated: true,
  });
  useOrganizationStore.setState({
    organizationType: 'TEAM',
    permissions,
    permissionsResolved: true,
  });
}
const MANAGES_EVERYTHING: OrganizationPermission[] = [
  'membership:create',
  'membership:update',
  'membership:delete',
  'role:read',
];

beforeEach(() => {
  vi.resetAllMocks();
  // `clearAllMocks` keeps implementations, so a per-test `mockReturnValue` for
  // the write would leak into the next case.
  removeMutate.mockReset();
  removeMutateSync.mockReset();
  removeMemberOptions.length = 0;
  revokeInvitationOptions.length = 0;
  deferredCommits.length = 0;
  rowMenuCrash.current = false;
  useOrganizationStore.getState().clearOrganization();
  usePlatformRolesMock.mockReturnValue(
    rolesResult([role('rol_owner', 'Owner'), role('rol_member', 'Member')]),
  );
});

/** Open the row menu, pick Remove, and accept the confirm dialog. */
async function confirmRemoval(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('member-actions-mem_1'));
  await user.click(await screen.findByTestId('member-remove-mem_1'));
  await user.click(await screen.findByTestId('confirm-accept'));
}

describe('OrganizationMembersPanel — the Users room (D17)', () => {
  it('links into the Team when the member can open the Users room', () => {
    setPermissions(['membership:read', 'role:read', 'membership:update']);
    render(<OrganizationMembersPanel />);
    expect(screen.getByTestId('users-room-link-members')).toBeInTheDocument();
    expect(screen.queryByTestId('members-list')).toBeNull();
    expect(useMembersMock).not.toHaveBeenCalled();
  });

  it('keeps the members list for a member the room is shut to — no membership:read', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setPermissions(['organization:read']);
    render(<OrganizationMembersPanel />);
    expect(screen.queryByTestId('users-room-link-members')).toBeNull();
    expect(screen.getByTestId('members-list')).toBeInTheDocument();
  });
});

describe('OrganizationMembersPanel', () => {
  it('shows an empty state when there are no members', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [] }));
    render(<OrganizationMembersPanel />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows a loading skeleton', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [], isPending: true }));
    render(<OrganizationMembersPanel />);
    expect(screen.getByTestId('members-loading')).toBeInTheDocument();
  });

  it('dims the current rows while new search params load — never a skeleton (X-2)', () => {
    // Search lives in the query key, so a keystroke is a new query. With
    // keepPreviousData the rows stay put and only dim; without it the panel
    // swapped them for a skeleton and the list blanked on every keystroke.
    useMembersMock.mockReturnValue(
      membersQueryResult({ rows: [MEMBER], isFetching: true, isRefreshing: true }),
    );
    render(<OrganizationMembersPanel />);

    expect(screen.queryByTestId('members-loading')).not.toBeInTheDocument();
    const list = screen.getByTestId('members-list');
    expect(list).toBeInTheDocument();
    expect(screen.getByText('Jo Rivera')).toBeInTheDocument();
    expect(list.closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows an actions menu for a non-owner member and the real role name', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    render(<OrganizationMembersPanel />);
    expect(screen.getByText('Jo Rivera')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByTestId('member-actions-mem_1')).toBeInTheDocument();
  });

  it('hides actions for the owner (an org cannot manage its owner here)', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [OWNER] }));
    setCanManage(true);
    render(<OrganizationMembersPanel />);
    expect(screen.getByText('Ada Byron')).toBeInTheDocument();
    expect(screen.queryByTestId('member-actions-mem_owner')).not.toBeInTheDocument();
  });

  it('hides actions without the capability (e.g. a personal org)', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(false);
    render(<OrganizationMembersPanel />);
    expect(screen.getByText('Jo Rivera')).toBeInTheDocument();
    expect(screen.queryByTestId('member-actions-mem_1')).not.toBeInTheDocument();
  });

  it('changes the main role to a real org role and keeps the others (sends role_ids)', async () => {
    // Regression: the reachable Members panel could not change a member's role.
    // Picks a DIFFERENT role than the member's own — re-picking the current one
    // is a no-op by design now (SET-12).
    usePlatformRolesMock.mockReturnValue(
      rolesResult([
        role('rol_owner', 'Owner'),
        role('rol_member', 'Member'),
        role('rol_admin', 'Admin'),
      ]),
    );
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_1'));
    await user.click(await screen.findByTestId('member-set-role-rol_admin'));

    await waitFor(() =>
      expect(updateMemberMutate).toHaveBeenCalledWith({
        membershipId: 'mem_1',
        change: { roleIds: ['rol_admin', 'rol_extra'] },
      }),
    );
  });

  // ── SET-12: one membership write per gesture ─────────────────────────────

  it('sends nothing when the role a member already has is re-picked', async () => {
    // Radix fires onValueChange for the selected item too, so opening the menu
    // and clicking the current role PATCHed and toasted "Role updated" for a
    // change that did not happen.
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_1'));
    await user.click(await screen.findByTestId('member-set-role-rol_member'));

    expect(updateMemberMutate).not.toHaveBeenCalled();
  });

  it('disables the role menu while a role change is in flight', async () => {
    // `useAppMutation` JOINS a second call to the one already running, so a
    // second pick looked accepted and then vanished. Say "busy" instead.
    usePlatformRolesMock.mockReturnValue(
      rolesResult([
        role('rol_owner', 'Owner'),
        role('rol_member', 'Member'),
        role('rol_admin', 'Admin'),
      ]),
    );
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_1'));
    await user.click(await screen.findByTestId('member-set-role-rol_admin'));
    expect(updateMemberMutate).toHaveBeenCalledTimes(1);

    // The menu closes on select, so the disabled items are out of sight — the
    // row's own control has to carry the busy state.
    const trigger = screen.getByTestId('member-actions-mem_1');
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(trigger.querySelector('[data-slot="spinner"]')).not.toBeNull();

    // Radix closes the menu on select; reopen it and try to pick again.
    await user.click(screen.getByTestId('member-actions-mem_1'));
    const other = await screen.findByTestId('member-set-role-rol_member');
    expect(other).toHaveAttribute('aria-disabled', 'true');

    await user.click(other);
    expect(updateMemberMutate).toHaveBeenCalledTimes(1);
  });

  it('contains a crash in a row menu to that row', async () => {
    // One member's actions are their own failure domain — a throw there must
    // not blank the whole list.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    rowMenuCrash.current = true;
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    render(<OrganizationMembersPanel />);

    expect(await screen.findByTestId('member-actions-error-mem_1')).toBeInTheDocument();
    expect(screen.getByTestId('members-list')).toBeInTheDocument();
    expect(screen.getByText('Jo Rivera')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('suspends a member', async () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_1'));
    await user.click(await screen.findByTestId('member-toggle-status-mem_1'));

    await waitFor(() =>
      expect(updateMemberMutate).toHaveBeenCalledWith({
        membershipId: 'mem_1',
        change: { status: 'suspended' },
      }),
    );
  });

  it('hides suspend/reactivate for an invited (never-joined) member', async () => {
    // clinozy-be rejects flipping a never-joined membership to active, so the FE
    // must not offer it — invited members get role-change + the invitation's actions.
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_inv'));
    await screen.findByTestId('member-cancel-invite-mem_inv');
    expect(screen.queryByTestId('member-toggle-status-mem_inv')).not.toBeInTheDocument();
  });

  it('confirms and removes a member from the actions menu', async () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await confirmRemoval(user);

    await waitFor(() =>
      expect(removeMutate).toHaveBeenCalledWith({
        membershipId: 'mem_1',
        reason: 'not_needed',
      }),
    );
    // Through `mutateAsync` only — `mutate` returns void and cannot be awaited.
    expect(removeMutateSync).not.toHaveBeenCalled();
  });

  // ── SET-7: the deferred removal is tied to the write it defers ───────────

  it('does not resolve the deferred commit until the DELETE lands', async () => {
    // The bug: the panel scheduled `() => removeMember.mutate(id)`, which
    // returns void. The deferred commit resolved the instant it fired, so the
    // toast reported the removal before the request had been answered.
    let completeWrite!: () => void;
    removeMutate.mockReturnValue(
      new Promise<void>((resolve) => {
        completeWrite = resolve;
      }),
    );
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await confirmRemoval(user);
    // Keyed on the SCHEDULE, not on which entry point ran — the assertions
    // below are what must tell `mutateAsync` apart from `mutate`.
    await waitFor(() => expect(deferredCommits).toHaveLength(1));

    let committed = false;
    void lastDeferred().commit.then(() => {
      committed = true;
    });
    await flushMicrotasks();
    // The DELETE is still in flight, so the commit must still be open.
    expect(committed).toBe(false);

    completeWrite();
    await act(async () => {
      await lastDeferred().commit;
    });
    expect(committed).toBe(true);
  });

  it('lets a failed DELETE reject, so the rollback path can run', async () => {
    // `mutate` never rejects, so `onCommitError` could not fire and the row
    // stayed gone after a delete the server refused.
    const failure = new Error('Forbidden');
    removeMutate.mockImplementation(() => Promise.reject(failure));
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await confirmRemoval(user);
    await waitFor(() => expect(deferredCommits).toHaveLength(1));

    await expect(lastDeferred().commit).rejects.toBe(failure);
  });

  it('silences the mutation toast so one removal is confirmed once', () => {
    // The undo toast owns the whole sequence; without this the user got the
    // mutation's "Member removed" AND the deferred one, five seconds apart.
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    render(<OrganizationMembersPanel />);

    expect(removeMemberOptions.at(-1)).toEqual({ suppressSuccessToast: true });
  });

  it('renders a search box and forwards the debounced term to the hook', async () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [] }));
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.type(screen.getByTestId('members-search'), 'jo');
    await waitFor(() =>
      expect(useMembersMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'jo', sort: 'name', order: 'asc' }),
      ),
    );
  });

  it('loads the next page when Load more is clicked', async () => {
    const fetchNextPage = vi.fn();
    useMembersMock.mockReturnValue(
      membersQueryResult({ rows: [MEMBER], hasNextPage: true, fetchNextPage }),
    );
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('members-load-more'));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('exposes an Invite member button for a manager', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    render(<OrganizationMembersPanel />);
    expect(screen.getByTestId('invite-member-open')).toBeInTheDocument();
  });

  it('hides the invite button without membership:create', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(false);
    render(<OrganizationMembersPanel />);
    expect(screen.queryByTestId('invite-member-open')).not.toBeInTheDocument();
  });

  // The dialog cannot complete an invite without a role to assign, and
  // `GET .../roles` enforces `role:read` — so a caller holding only
  // `membership:create` gets no trigger rather than a dead picker.
  it('hides the invite button without role:read', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    useAuthStore.setState({
      user: { id: 'u', email: 'a@b.test', role: 'user' },
      isAuthenticated: true,
    });
    useOrganizationStore.setState({
      organizationType: 'TEAM',
      permissions: ['membership:create'],
      permissionsResolved: true,
    });
    render(<OrganizationMembersPanel />);
    expect(screen.queryByTestId('invite-member-open')).not.toBeInTheDocument();
  });

  // ── SET-19: the list says "not current yet" from the first keystroke ──────

  it('dims the rows the moment the search changes, and never blanks them', async () => {
    // `keepPreviousData` already stops the skeleton swap (X-2). The remaining
    // gap was the debounce window: for ~300ms the list showed an answer to a
    // question the user had already changed, and said nothing about it.
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    render(<OrganizationMembersPanel />);

    expect(screen.getByTestId('members-list').closest('[aria-busy="true"]')).toBeNull();

    fireEvent.change(screen.getByTestId('members-search'), { target: { value: 'jo' } });

    // Immediately: before the debounce fires, before any request starts.
    expect(
      screen.getByTestId('members-list').closest('[aria-busy="true"]'),
    ).not.toBeNull();
    // …and the rows are still there. No skeleton, no height collapse.
    expect(screen.queryByTestId('members-loading')).not.toBeInTheDocument();
    expect(screen.getByText('Jo Rivera')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId('members-list').closest('[aria-busy="true"]')).toBeNull(),
    );
  });

  // ── SET-23: the invite slot keeps its place while permissions load ───────

  it('holds the invite slot with a disabled placeholder before permissions land', () => {
    // Regression: `useCan` is synchronous and the guard chain fills the store a
    // beat later, so the button was absent and then popped in.
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    useOrganizationStore.setState({ permissionsResolved: false });
    render(<OrganizationMembersPanel />);

    expect(screen.getByTestId('invite-member-pending')).toBeDisabled();
    expect(screen.queryByTestId('invite-member-open')).not.toBeInTheDocument();
  });

  it('swaps the placeholder for the real trigger once they do', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    setCanManage(true);
    render(<OrganizationMembersPanel />);

    expect(screen.getByTestId('invite-member-open')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-member-pending')).not.toBeInTheDocument();
  });
});

describe('OrganizationMembersPanel — pending invitations', () => {
  /** Open an invited row's menu and pick Cancel invitation. */
  async function openCancel(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('member-actions-mem_inv'));
    await user.click(await screen.findByTestId('member-cancel-invite-mem_inv'));
  }

  it('offers resend and cancel on a pending invitation, in place of Remove', async () => {
    // Remove deleted the membership but left the invitation live, so the
    // invitee's link failed with "not found" instead of saying it was revoked.
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_inv'));

    expect(await screen.findByTestId('member-resend-invite-mem_inv')).toBeInTheDocument();
    expect(screen.getByTestId('member-cancel-invite-mem_inv')).toBeInTheDocument();
    expect(screen.queryByTestId('member-remove-mem_inv')).not.toBeInTheDocument();
  });

  it('shows when a pending invitation expires', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    render(<OrganizationMembersPanel />);

    expect(screen.getByTestId('member-invite-expiry-mem_inv')).toHaveTextContent(
      /^Invitation expires .*2099/,
    );
  });

  it('says an invitation has expired, and still offers resend and cancel', async () => {
    // clinozy-be sends a lapsed invitation again with a fresh link (T11).
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [EXPIRED_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    expect(screen.getByTestId('member-invite-expiry-mem_lapsed')).toHaveTextContent(
      'Invitation expired',
    );
    await user.click(screen.getByTestId('member-actions-mem_lapsed'));
    expect(
      await screen.findByTestId('member-cancel-invite-mem_lapsed'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('member-resend-invite-mem_lapsed')).toBeInTheDocument();
  });

  it('resends by the invited MEMBERSHIP id', async () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_inv'));
    await user.click(await screen.findByTestId('member-resend-invite-mem_inv'));

    expect(resendMutate).toHaveBeenCalledWith('mem_inv');
  });

  it('confirms, then revokes the invitation — never the bare membership delete', async () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await openCancel(user);
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent('sam@acme.test');
    // "Keep invitation", not a bare "Cancel" beside "Cancel invitation".
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Keep invitation');
    await user.click(screen.getByTestId('confirm-accept'));

    await waitFor(() => expect(deferredCommits).toHaveLength(1));
    await act(async () => {
      await lastDeferred().commit;
    });
    expect(revokeMutateAsync).toHaveBeenCalledWith('mem_inv');
    expect(removeMutate).not.toHaveBeenCalled();
    expect(removeMutateSync).not.toHaveBeenCalled();
  });

  it('keeps the invitation when the dialog is dismissed', async () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await openCancel(user);
    await user.click(await screen.findByTestId('confirm-cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument(),
    );
    expect(deferredCommits).toHaveLength(0);
    expect(revokeMutateAsync).not.toHaveBeenCalled();
  });

  it('lets a failed revoke reject, so the row comes back', async () => {
    const failure = new Error('Forbidden');
    revokeMutateAsync.mockImplementation(() => Promise.reject(failure));
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await openCancel(user);
    await user.click(await screen.findByTestId('confirm-accept'));
    await waitFor(() => expect(deferredCommits).toHaveLength(1));

    await expect(lastDeferred().commit).rejects.toBe(failure);
  });

  it('silences the revoke toast so one cancel is confirmed once', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(MANAGES_EVERYTHING);
    render(<OrganizationMembersPanel />);

    expect(revokeInvitationOptions.at(-1)).toEqual({ suppressSuccessToast: true });
  });

  it('with membership:update alone, an invited row offers resend — never cancel', async () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [PENDING_INVITE] }));
    setPermissions(['membership:update']);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_inv'));

    expect(await screen.findByTestId('member-resend-invite-mem_inv')).toBeInTheDocument();
    expect(screen.queryByTestId('member-cancel-invite-mem_inv')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-remove-mem_inv')).not.toBeInTheDocument();
  });

  it('with membership:delete alone, cancel and remove only — no role or status change', async () => {
    useMembersMock.mockReturnValue(
      membersQueryResult({ rows: [MEMBER, PENDING_INVITE] }),
    );
    setPermissions(['membership:delete']);
    const user = userEvent.setup();
    render(<OrganizationMembersPanel />);

    await user.click(screen.getByTestId('member-actions-mem_inv'));
    expect(await screen.findByTestId('member-cancel-invite-mem_inv')).toBeInTheDocument();
    expect(screen.queryByTestId('member-resend-invite-mem_inv')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-set-role-rol_member')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByTestId('member-actions-mem_1'));
    expect(await screen.findByTestId('member-remove-mem_1')).toBeInTheDocument();
    expect(screen.queryByTestId('member-toggle-status-mem_1')).not.toBeInTheDocument();
  });

  it('names the main role only for a caller who may read roles', () => {
    useMembersMock.mockReturnValue(membersQueryResult({ rows: [MEMBER] }));
    usePlatformRolesMock.mockReturnValue(rolesResult([]));
    setPermissions(['organization:read']);
    render(<OrganizationMembersPanel />);
    expect(screen.getByText('Jo Rivera')).toBeInTheDocument();
    expect(screen.queryByText('Member')).not.toBeInTheDocument();
  });
});
