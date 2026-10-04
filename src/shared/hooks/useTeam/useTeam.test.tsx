import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { branchRef } from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { STAFF_PROFILE_DEFAULTS } from '@/shared/api/clinic/users-contracts.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  useMyStaffProfile,
  usePlatformRoles,
  useRemoveStaffProfile,
  useSaveStaffProfile,
  useStaffProfiles,
  useTeam,
} from './useTeam.ts';

const { listMembers, listRoles } = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', () => ({ listMembers, listRoles }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ORG = 'org_aaaaaaaaaaaaaaaaaaaaa';
const ADMIN: RoleSummary = {
  id: 'rol_adminaaaaaaaaaaaaaaaa',
  name: 'Admin',
  description: '',
  permissions: [],
  memberCount: 1,
  isSystem: true,
};
const OWNER: RoleSummary = { ...ADMIN, id: 'rol_owneraaaaaaaaaaaaaaaa', name: 'Owner' };

function member(key: string, email: string, overrides: Partial<Member> = {}): Member {
  return {
    id: `mbr_${key}`,
    userId: `usr_${key}`,
    name: email,
    email,
    role: 'admin',
    roleId: ADMIN.id,
    roleName: 'Admin',
    status: 'active',
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
    ...overrides,
  };
}

const ROSTER = [
  member('me', 'me@clinic.com', {
    name: 'Kavya Mehta',
    role: 'owner',
    roleId: OWNER.id,
    roleName: 'Owner',
  }),
  member('riya', 'riya@cresence.skin'),
];

/** One page holding `rows`. */
const page = <T,>(rows: T[]) => ({ rows, next: null, hasMore: false });

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function signIn(codes: OrganizationPermission[]) {
  useAuthStore.setState({
    user: { id: 'usr_me', email: 'me@clinic.com', role: 'user' } as AuthUser,
  });
  useOrganizationStore.setState({ organizationId: ORG });
  useOrganizationStore.getState().setPermissions(codes);
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  resetClinicFixtures();
  listMembers.mockReset().mockResolvedValue(page(ROSTER));
  listRoles.mockReset().mockResolvedValue(page([OWNER, ADMIN]));
  signIn(['organization:read', 'membership:read', 'role:read', 'membership:manage']);
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
  useAuthStore.setState({ user: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useTeam', () => {
  it('joins the whole roster with the staff profiles, newest #ID first', async () => {
    const { result } = renderHook(() => useTeam(), { wrapper });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.members.map((row) => [row.name, row.seq])).toEqual([
      ['Riya Shah', 12],
      ['Kavya Mehta', null],
    ]);
    expect(result.current.members[1]).toMatchObject({
      isSelf: true,
      isOwner: true,
      roleKeys: ['owner'],
    });
    expect(listMembers).toHaveBeenCalledWith({ limit: 100 });
  });

  it('reads no roster without membership:read', async () => {
    signIn(['organization:read']);
    const { result } = renderHook(() => useTeam(), { wrapper });
    await waitFor(() => expect(listRoles).not.toHaveBeenCalled());
    expect(result.current.isPending).toBe(true);
    expect(listMembers).not.toHaveBeenCalled();
  });

  it('renders without the roles when the viewer can’t read them', async () => {
    signIn(['organization:read', 'membership:read']);
    const { result } = renderHook(() => useTeam(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(listRoles).not.toHaveBeenCalled();
    expect(result.current.members).toHaveLength(2);
  });

  it('reports a roster failure in place, and reads again on Retry', async () => {
    listMembers.mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderHook(() => useTeam(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('connection dropped');
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.members).toHaveLength(2));
    expect(result.current.isError).toBe(false);
  });

  it('refreshes when any member write invalidates the members prefix', async () => {
    const { result } = renderHook(() => useTeam(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    listMembers.mockResolvedValue(page([...ROSTER, member('new', 'new@clinic.com')]));
    await act(() => client.invalidateQueries({ queryKey: orgQueryKeys.members(ORG) }));
    await waitFor(() => expect(result.current.members).toHaveLength(3));
  });
});

describe('the staff profile writes', () => {
  it('saves an invited member’s profile, which the Team then shows under its name', async () => {
    listMembers.mockResolvedValue(
      page([
        ...ROSTER,
        member('ishita', 'ishita@clinic.com', {
          role: 'member',
          roleId: 'rol_memberaaaaaaaaaaaaaaa',
          roleName: 'Member',
          status: 'invited',
          joinedAt: '',
          invitation: { id: 'inv_one', expiresAt: '2026-10-10T04:30:00.000Z' },
        }),
      ]),
    );
    const { result } = renderHook(
      () => ({ team: useTeam(), save: useSaveStaffProfile() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.team.isPending).toBe(false));
    const ishita = () =>
      result.current.team.members.find((row) => row.membershipId === 'mbr_ishita');
    expect(ishita()?.name).toBe('ishita@clinic.com');

    await act(() =>
      result.current.save.mutateAsync({
        ...STAFF_PROFILE_DEFAULTS,
        roleKeys: ['doctor'],
        branchIds: [branchRef('Adajan')],
        membershipId: 'mbr_ishita',
        name: 'Dr. Ishita Rao',
        email: 'ishita@clinic.com',
      }),
    );
    await waitFor(() =>
      expect(ishita()).toMatchObject({
        name: 'Dr. Ishita Rao',
        seq: 19,
        status: 'invited',
        roleKeys: ['doctor'],
      }),
    );
    expect(result.current.team.members[0]?.membershipId).toBe('mbr_ishita');
  });

  it('removes a profile, and the member’s row falls back to the membership', async () => {
    const { result } = renderHook(
      () => ({ team: useTeam(), remove: useRemoveStaffProfile() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.team.isPending).toBe(false));
    const riya = result.current.team.members[0]?.profile;
    if (!riya) throw new Error('Riya has a profile');
    await act(() =>
      result.current.remove.mutateAsync({
        id: riya.id,
        reason: 'no_longer_needed',
        note: null,
      }),
    );
    await waitFor(() =>
      expect(result.current.team.members.map((row) => row.profile)).toEqual([null, null]),
    );
  });
});

describe('usePlatformRoles', () => {
  it('reads every clinozy-be role for a viewer with role:read', async () => {
    const { result } = renderHook(() => usePlatformRoles(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.roles).toEqual([OWNER, ADMIN]);
  });

  it('reads nothing, and is never pending, without role:read', async () => {
    signIn(['organization:read', 'membership:read']);
    const { result } = renderHook(() => usePlatformRoles(), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.roles).toEqual([]);
    expect(listRoles).not.toHaveBeenCalled();
  });

  it('reports a failure in place and reads again on Retry', async () => {
    listRoles.mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderHook(() => usePlatformRoles(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.roles).toHaveLength(2));
  });
});

describe('useMyStaffProfile', () => {
  it('reads the signed-in member’s profile by their sign-in email', async () => {
    useAuthStore.setState({
      user: { id: 'usr_riya', email: 'riya@cresence.skin', role: 'user' } as AuthUser,
    });
    const { result } = renderHook(() => useMyStaffProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.seq).toBe(12);
  });

  it('is null for a member without one', async () => {
    const { result } = renderHook(() => useMyStaffProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useStaffProfiles', () => {
  it('reads every live staff profile into the one cache entry the Team joins', async () => {
    const { result } = renderHook(() => useStaffProfiles(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.some((profile) => profile.seq === 12)).toBe(true);
    expect(client.getQueryData(['clinic', 'staff', 'profiles'])).toBe(
      result.current.data,
    );
  });
});
