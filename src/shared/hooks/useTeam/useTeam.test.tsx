import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { usePlatformRoles, useTeam } from './useTeam.ts';

const { listMembers, listRoles } = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', () => ({ listMembers, listRoles }));

const ORG = 'org_aaaaaaaaaaaaaaaaaaaaa';
const ADMIN: RoleSummary = {
  id: 'rol_adminaaaaaaaaaaaaaaaa',
  name: 'Admin',
  description: '',
  permissions: [],
  memberCount: 1,
  isSystem: true,
  isLocked: true,
  tone: 'plum',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

function member(
  key: string,
  staffNumber: number,
  overrides: Partial<Member> = {},
): Member {
  return {
    id: `mem_${key.padEnd(21, '0')}`,
    userId: `usr_${key}`,
    name: `${key} name`,
    email: `${key}@clinic.com`,
    status: 'active',
    roleIds: [ADMIN.id],
    roleId: ADMIN.id,
    isOwner: false,
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
    staffNumber,
    phone: null,
    tone: 'sky',
    branchIds: [],
    workingDays: ['mon'],
    workStartsAt: '10:00',
    workEndsAt: '19:00',
    commissionPercent: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

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
  listMembers.mockReset();
  listRoles.mockReset();
});
afterEach(() => {
  client.clear();
  useAuthStore.setState({ user: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useTeam', () => {
  it('reads the whole roster with membership:read — the newest #ID first, you marked', async () => {
    signIn(['organization:read', 'membership:read']);
    listMembers.mockResolvedValue(
      page([member('riya', 3), member('me', 12, { isOwner: true })]),
    );
    const { result } = renderHook(() => useTeam(), { wrapper });
    await waitFor(() => expect(result.current.members).toHaveLength(2));
    expect(
      result.current.members.map((row) => [row.seq, row.isSelf, row.isOwner]),
    ).toEqual([
      [12, true, true],
      [3, false, false],
    ]);
    expect(result.current.isPending).toBe(false);
  });

  it('reads nothing — and is never pending — without membership:read', () => {
    signIn(['organization:read']);
    const { result } = renderHook(() => useTeam(), { wrapper });
    expect(result.current).toMatchObject({ members: [], isPending: false });
    expect(listMembers).not.toHaveBeenCalled();
  });

  it('reports a failed read in place, and Retry reads again', async () => {
    signIn(['organization:read', 'membership:read']);
    listMembers.mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => useTeam(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    listMembers.mockResolvedValue(page([member('me', 1)]));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.members).toHaveLength(1));
  });
});

describe('usePlatformRoles', () => {
  it('reads every role with role:read', async () => {
    signIn(['organization:read', 'role:read']);
    listRoles.mockResolvedValue(page([ADMIN]));
    const { result } = renderHook(() => usePlatformRoles(), { wrapper });
    await waitFor(() => expect(result.current.roles).toEqual([ADMIN]));
  });

  it('reads nothing without role:read, or when not enabled', () => {
    signIn(['organization:read']);
    const { result, unmount } = renderHook(() => usePlatformRoles(), { wrapper });
    expect(result.current).toMatchObject({ roles: [], isPending: false });
    unmount();
    signIn(['organization:read', 'role:read']);
    const off = renderHook(() => usePlatformRoles(false), { wrapper });
    expect(off.result.current).toMatchObject({ roles: [], isPending: false });
    expect(listRoles).not.toHaveBeenCalled();
  });
});
