import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/api/app/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTaskWorkerIds: vi.fn(),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));
import {
  type DirectoryMember,
  fetchTeamDirectory,
} from '@/shared/api/app/directory-api.ts';
import { fetchTaskWorkerIds } from '@/shared/api/app/tasks-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import {
  taskAssigneeKeyOf,
  taskAssigneeOfKey,
  useTaskAssignees,
} from './useTaskAssignees.ts';

const member = (id: string, name: string): DirectoryMember => ({
  id,
  userId: `usr_${id}`,
  name,
  initials: name.slice(0, 2).toUpperCase(),
  tone: 'sky',
  roleIds: ['rol_frontdesk0000000000000'],
  branchIds: [],
});

const RIYA = member('mem_riya000000000000000000', 'Riya Shah');
const ASHA = member('mem_asha000000000000000000', 'Asha Mehta');
const RAHUL = member('mem_rahul00000000000000000', 'Rahul Jain');

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchTeamDirectory).mockResolvedValue([ASHA, RAHUL, RIYA]);
  vi.mocked(findMyMembershipId).mockResolvedValue(RIYA.id);
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useTaskAssignees (KICKOFF §6.10 Dropdowns › Assigned)', () => {
  it('offers only the members who can work tasks, the member first as "<name> (you)"', async () => {
    // Rahul (say, the accountant) holds no task code (D81 T8).
    vi.mocked(fetchTaskWorkerIds).mockResolvedValue([ASHA.id, RIYA.id]);
    const { result } = renderHook(() => useTaskAssignees(), { wrapper });
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.options.map((option) => option.key)).toEqual([
      RIYA.id,
      ASHA.id,
    ]);
    expect(result.current.options[0]?.label).toBe('Riya Shah (you)');
    expect(result.current.myMembershipId).toBe(RIYA.id);
    expect(result.current.byId.get(RAHUL.id)?.name).toBe('Rahul Jain');
    expect(result.current.isPending).toBe(false);
  });

  it('offers nobody until it knows who can work tasks', async () => {
    vi.mocked(fetchTaskWorkerIds).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useTaskAssignees(), { wrapper });
    await waitFor(() => expect(result.current.byId.size).toBe(3));
    expect(result.current.options).toEqual([]);
    expect(result.current.isPending).toBe(true);
  });
});

describe('the assignee picker keys', () => {
  it('names a member by membership id and a role queue as role:<role>', () => {
    expect(taskAssigneeKeyOf({ membershipId: RIYA.id })).toBe(RIYA.id);
    expect(taskAssigneeKeyOf({ role: 'front_desk' })).toBe('role:front_desk');
    expect(taskAssigneeOfKey(RIYA.id)).toEqual({ membershipId: RIYA.id });
    expect(taskAssigneeOfKey('role:counsellor')).toEqual({ role: 'counsellor' });
    expect(taskAssigneeOfKey('role:nobody')).toEqual({ membershipId: 'role:nobody' });
  });
});
