import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as branchesApi from '@/shared/api/app/branches-api.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';
import { saveMyPreferences } from '@/shared/api/app/preferences-api.ts';
import {
  DEFAULT_BRANCH_HOURS,
  rememberBranchHours,
  rememberedBranchHours,
} from '@/shared/app/branch-hours.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import { useBranchHours, useRememberBranchHours } from './useBranchHours.ts';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The seed's branches: the main one first (Adajan), then Vesu and Varachha. */
async function seedBranches() {
  const [main, second] = await branchesApi.fetchActiveBranches();
  if (!(main && second)) throw new Error('the seed has two branches');
  return { main, second };
}

beforeEach(() => {
  signInTestMember();
  resetAppFixtures();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useBranchHours', () => {
  it('reads a branch’s own hours by its id', async () => {
    const { second } = await seedBranches();
    const { result } = renderHook(() => useBranchHours(), { wrapper });
    await waitFor(() =>
      expect(result.current(second.id)).toEqual({
        opensAt: second.opensAt,
        closesAt: second.closesAt,
        workingDays: second.workingDays,
      }),
    );
  });

  it('reads the current branch’s for no id, or one no longer open: the main one by default', async () => {
    const { main } = await seedBranches();
    const { result } = renderHook(() => useBranchHours(), { wrapper });
    await waitFor(() => expect(result.current(null).opensAt).toBe(main.opensAt));
    expect(result.current('brn_closed')).toEqual(result.current(null));
  });

  it('reads the header’s one branch as the current one', async () => {
    const { second } = await seedBranches();
    await saveMyPreferences({ branchFilter: [second.id] });
    const { result } = renderHook(() => useBranchHours(), { wrapper });
    await waitFor(() => expect(result.current(null).opensAt).toBe(second.opensAt));
  });

  it('reads the default hours while the branches load', () => {
    const { result } = renderHook(() => useBranchHours(), { wrapper });
    expect(result.current(null)).toEqual(DEFAULT_BRANCH_HOURS);
  });
});

describe('useRememberBranchHours', () => {
  it('keeps the current branch’s hours on the device once the branches load', async () => {
    const { second } = await seedBranches();
    await saveMyPreferences({ branchFilter: [second.id] });
    renderHook(() => useRememberBranchHours(), { wrapper });
    await waitFor(() =>
      expect(rememberedBranchHours()).toEqual({
        opensAt: second.opensAt,
        closesAt: second.closesAt,
        workingDays: second.workingDays,
      }),
    );
  });

  it('leaves what is kept while the clinic has no open branch', async () => {
    vi.spyOn(branchesApi, 'fetchActiveBranches').mockResolvedValue([]);
    const kept = { opensAt: '09:00', closesAt: '17:00', workingDays: ['mon'] } as const;
    rememberBranchHours(kept);
    const { result } = renderHook(
      () => {
        useRememberBranchHours();
        return useBranchHours();
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current(null)).toEqual(DEFAULT_BRANCH_HOURS));
    expect(rememberedBranchHours()).toEqual(kept);
  });
});
