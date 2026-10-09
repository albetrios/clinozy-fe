import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';

import { useMyMembershipId } from './useMyMembership.ts';

function renderMine() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMyMembershipId(), { wrapper });
}

describe('useMyMembershipId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ user: null });
    useOrganizationStore.setState({ organizationId: null });
  });

  it('looks up the signed-in member in the active organization', async () => {
    vi.mocked(findMyMembershipId).mockResolvedValue('mem_me');
    useAuthStore.setState({
      user: { id: 'usr_me', email: 'me@x.test', role: 'user' } as AuthUser,
    });
    useOrganizationStore.setState({ organizationId: 'org_a' });

    const { result } = renderMine();

    await waitFor(() => expect(result.current).toBe('mem_me'));
    expect(findMyMembershipId).toHaveBeenCalledWith('usr_me');
  });

  it('waits — undefined, no lookup — until both the user and the organization are known', () => {
    useAuthStore.setState({
      user: { id: 'usr_me', email: 'me@x.test', role: 'user' } as AuthUser,
    });

    const { result } = renderMine();

    expect(result.current).toBeUndefined();
    expect(findMyMembershipId).not.toHaveBeenCalled();
  });
});
