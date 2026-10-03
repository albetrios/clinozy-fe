import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { useBranches } from './useBranches.ts';

function renderBranches() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBranches(), { wrapper });
}

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('useBranches', () => {
  it('loads the open branches, the main one first', async () => {
    const { result } = renderBranches();
    expect(result.current.isPending).toBe(true);
    expect(result.current.isMultiBranch).toBe(false);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.openBranches[0]?.isMain).toBe(true);
  });

  it('is multi-branch with two or more open branches', async () => {
    const { result } = renderBranches();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.openBranches).toHaveLength(3);
    expect(result.current.isMultiBranch).toBe(true);
  });

  it('is single-branch once the other branches close — a closed branch never counts', async () => {
    for (const branch of clinicFixtures.branches.snapshot((row) => !row.isMain)) {
      await clinicFixtures.branches.update(branch.id, { active: false });
    }
    const { result } = renderBranches();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.openBranches.map((branch) => branch.isMain)).toEqual([true]);
    expect(result.current.isMultiBranch).toBe(false);
  });
});
