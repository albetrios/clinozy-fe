import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { branchQueryKeys } from '@/shared/api/app/branches-api.ts';
import type * as BranchesManageApiModule from '@/shared/api/app/branches-manage-api.ts';
import { saveBranch } from '@/shared/api/app/branches-manage-api.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { appBranch } from '@/tests/utils/branch-doubles.ts';

import { useSaveBranch } from './useBranchWrites.ts';

vi.mock('@/shared/api/app/branches-manage-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchesManageApiModule>()),
  saveBranch: vi.fn(),
}));

describe('useSaveBranch', () => {
  it('saves once per press — its own idempotency key — and refreshes every branch read and the Team', async () => {
    useOrganizationStore.getState().setOrganization('org_test', 'acme');
    vi.mocked(saveBranch).mockResolvedValue(appBranch());
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSaveBranch(), { wrapper });
    const save = {
      branch: appBranch(),
      input: { name: 'Vesu' } as never,
      memberIds: [],
    };
    await act(() => result.current.mutateAsync(save));
    expect(saveBranch).toHaveBeenCalledWith({ save, idempotencyKey: expect.any(String) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: branchQueryKeys.all });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orgQueryKeys.members('org_test'),
    });
    useOrganizationStore.getState().clearOrganization();
  });
});
