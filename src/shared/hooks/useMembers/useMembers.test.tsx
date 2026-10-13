import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListPage } from '@/shared/api/fetch-list-page.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

const {
  listMembers,
  updateMember,
  removeMember,
  leaveOrganization,
  invalidateSessionContext,
} = vi.hoisted(() => ({
  listMembers: vi.fn(),
  updateMember: vi.fn(),
  removeMember: vi.fn(),
  leaveOrganization: vi.fn(),
  invalidateSessionContext: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', () => ({
  listMembers,
  updateMember,
  removeMember,
  leaveOrganization,
}));
vi.mock('@/shared/tenancy/session-context.ts', () => ({ invalidateSessionContext }));

const { notifySuccess, notifyError } = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: notifySuccess, error: notifyError },
}));

import type { Member } from '@/shared/api/organization-contracts.ts';

import {
  useLeaveOrganization,
  useMembers,
  useRemoveMember,
  useUpdateMember,
  withMemberChange,
} from './useMembers.ts';

type Row = { id: string; roleIds?: string[]; roleId?: string; status?: string };

const ORG = 'org_aaaaaaaaaaaaaaaaaaaaa';
// The infinite list caches under the param-scoped child key; mutations patch it
// via the `members(ORG)` prefix.
const LIST_KEY = orgQueryKeys.membersList(ORG, {});

/** Seed a single accumulated page so optimistic patches have a cache to touch. */
function seedPage(client: QueryClient, rows: Row[]) {
  client.setQueryData<InfiniteData<ListPage<Row>>>(LIST_KEY, {
    pages: [{ rows, next: null, hasMore: false }],
    pageParams: [undefined],
  });
}

const pageRows = (client: QueryClient): Row[] | undefined =>
  client.getQueryData<InfiniteData<ListPage<Row>>>(LIST_KEY)?.pages[0]?.rows;
const ids = (client: QueryClient) => pageRows(client)?.map((r) => r.id);

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  useOrganizationStore.setState({ organizationId: ORG });
});

afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
});

describe('useMembers', () => {
  it('accumulates the first page of members under the list key', async () => {
    listMembers.mockResolvedValue({
      rows: [{ id: 'm_1', name: 'Ada' }],
      next: null,
      hasMore: false,
    });
    const { result } = renderHook(() => useMembers(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows).toEqual([{ id: 'm_1', name: 'Ada' }]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('passes the search term through to the fetcher', async () => {
    listMembers.mockResolvedValue({ rows: [], next: null, hasMore: false });
    renderHook(() => useMembers({ q: 'ada' }), { wrapper });
    await waitFor(() =>
      expect(listMembers).toHaveBeenCalledWith(expect.objectContaining({ q: 'ada' })),
    );
  });

  it('stays idle without an active organization (no doomed request mid-switch)', async () => {
    useOrganizationStore.setState({ organizationId: null });
    const { result } = renderHook(() => useMembers(), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(listMembers).not.toHaveBeenCalled();
  });
});

describe('useUpdateMember', () => {
  it('optimistically patches the roles across the cached page, the main role first, and keeps it', async () => {
    seedPage(client, [
      { id: 'm_1', roleIds: ['rol_a'], roleId: 'rol_a' },
      { id: 'm_2', roleIds: ['rol_a'], roleId: 'rol_a' },
    ]);
    updateMember.mockResolvedValue({ id: 'm_1', roleIds: ['rol_b', 'rol_a'] });
    const { result } = renderHook(() => useUpdateMember(), { wrapper });

    result.current.mutate({
      membershipId: 'm_1',
      change: { roleIds: ['rol_b', 'rol_a'] },
    });

    await waitFor(() =>
      expect(pageRows(client)?.find((m) => m.id === 'm_1')?.roleId).toBe('rol_b'),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pageRows(client)?.find((m) => m.id === 'm_2')?.roleId).toBe('rol_a');
    expect(updateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: 'm_1',
        change: { roleIds: ['rol_b', 'rol_a'] },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(notifySuccess).toHaveBeenCalledWith('Member role updated');
  });

  it('optimistically flips the status badge and says "suspended"', async () => {
    seedPage(client, [{ id: 'm_1', status: 'active' }]);
    updateMember.mockResolvedValue({ id: 'm_1', status: 'suspended' });
    const { result } = renderHook(() => useUpdateMember(), { wrapper });

    result.current.mutate({ membershipId: 'm_1', change: { status: 'suspended' } });

    await waitFor(() => expect(pageRows(client)?.[0]?.status).toBe('suspended'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith('Member suspended');
  });

  it('says "saved" for any other change', async () => {
    seedPage(client, [{ id: 'm_1' }]);
    updateMember.mockResolvedValue({ id: 'm_1' });
    const { result } = renderHook(() => useUpdateMember(), { wrapper });
    await result.current.mutateAsync({
      membershipId: 'm_1',
      change: { commissionPercent: 10, roleIds: ['rol_a'] },
    });
    expect(notifySuccess).toHaveBeenCalledWith('Member saved');
  });

  it('rolls back when the request fails', async () => {
    seedPage(client, [{ id: 'm_1', status: 'active' }]);
    updateMember.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUpdateMember(), { wrapper });

    result.current.mutate({ membershipId: 'm_1', change: { status: 'suspended' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(pageRows(client)?.[0]?.status).toBe('active');
    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});

describe('withMemberChange', () => {
  it('applies the change, never its expected updated_at', () => {
    const member = {
      id: 'm_1',
      roleIds: ['rol_a'],
      roleId: 'rol_a',
      updatedAt: 'x',
    } as Member;
    expect(
      withMemberChange(member, { roleIds: [], expectedUpdatedAt: 'y' }),
    ).toMatchObject({ roleIds: [], roleId: '', updatedAt: 'x' });
  });
});

describe('useRemoveMember', () => {
  it('optimistically drops the row and toasts on success', async () => {
    seedPage(client, [{ id: 'm_1' }, { id: 'm_2' }]);
    removeMember.mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveMember(), { wrapper });

    result.current.mutate({ membershipId: 'm_1', reason: 'not_needed' });

    await waitFor(() => expect(ids(client)).toEqual(['m_2']));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledTimes(1);
  });

  it('restores the removed row when the request fails', async () => {
    seedPage(client, [{ id: 'm_1' }, { id: 'm_2' }]);
    removeMember.mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useRemoveMember(), { wrapper });

    result.current.mutate({ membershipId: 'm_1', reason: 'not_needed' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ids(client)).toEqual(['m_1', 'm_2']);
    expect(notifyError).toHaveBeenCalledTimes(1);
  });
});

describe('useLeaveOrganization', () => {
  it('leaves, then drops the session context so the next guard reads it afresh', async () => {
    leaveOrganization.mockResolvedValue(undefined);
    const { result } = renderHook(() => useLeaveOrganization(), { wrapper });
    await result.current.mutateAsync();
    expect(leaveOrganization).toHaveBeenCalledTimes(1);
    expect(invalidateSessionContext).toHaveBeenCalledTimes(1);
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('keeps the session when clinozy-be refuses — the owner must transfer first', async () => {
    leaveOrganization.mockRejectedValue(new Error('owner cannot leave'));
    const { result } = renderHook(() => useLeaveOrganization(), { wrapper });
    await expect(result.current.mutateAsync()).rejects.toThrow('owner cannot leave');
    expect(invalidateSessionContext).not.toHaveBeenCalled();
  });
});
