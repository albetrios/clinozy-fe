import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
import {
  type DirectoryMember,
  fetchTeamDirectory,
} from '@/shared/api/clinic/directory-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { useTeamDirectory } from './useTeamDirectory.ts';

const NISHA: DirectoryMember = {
  id: 'mem_nisha0000000000000000',
  userId: 'usr_nisha0000000000000000',
  name: 'Dr. Nisha Shah',
  initials: 'NS',
  tone: 'sage',
  roleIds: [],
  branchIds: [],
};

function renderTeam() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTeamDirectory(), { wrapper });
}

describe('useTeamDirectory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useOrganizationStore.setState({ organizationId: null });
  });

  it('reads the team once an organization is active, by name and by membership id', async () => {
    vi.mocked(fetchTeamDirectory).mockResolvedValue([NISHA]);
    useOrganizationStore.setState({ organizationId: 'org_a' });

    const { result } = renderTeam();

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.members).toEqual([NISHA]);
    expect(result.current.byId.get(NISHA.id)).toEqual(NISHA);
    expect(result.current.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reads nothing without an organization: no members, no time', () => {
    const { result } = renderTeam();

    expect(fetchTeamDirectory).not.toHaveBeenCalled();
    expect(result.current.members).toEqual([]);
    expect(result.current.byId.size).toBe(0);
    expect(result.current.updatedAt).toBeNull();
  });
});
