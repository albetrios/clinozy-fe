import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_ACTOR_ID } from '@/shared/api/clinic/clinic-fixture-store.ts';
import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as TeamHooks from '@/shared/hooks/useTeam/index.ts';

import { useStaffLookup } from './useStaffLookup.ts';

/** The signed-in member: Riya, the front desk. */
const me = vi.hoisted(() => ({
  data: {
    id: 'me-0000-4000-8000-000000000001',
    firstName: 'Riya',
    lastName: 'Shah',
    initials: 'RS',
    tone: 'blush',
  } as const,
}));
vi.mock('@/shared/hooks/useTeam/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TeamHooks>();
  return { ...actual, useMyStaffProfile: () => me };
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useStaffLookup', () => {
  it('names a staff member a record points at, in their tone', async () => {
    const { result } = renderHook(() => useStaffLookup(), { wrapper });
    await waitFor(() => expect(result.current(staffRef('DD'))).not.toBeNull());
    expect(result.current(staffRef('DD'))).toMatchObject({
      id: staffRef('DD'),
      name: 'Dr. Drashti Moradiya',
      initials: 'DM',
    });
  });

  it('reads a record written in this session as the signed-in member', async () => {
    const { result } = renderHook(() => useStaffLookup(), { wrapper });
    expect(result.current(FIXTURE_ACTOR_ID)).toEqual({
      id: me.data.id,
      name: 'Riya Shah',
      initials: 'RS',
      tone: 'blush',
    });
  });

  it('knows nobody for no id, or an id it has never seen', async () => {
    const { result } = renderHook(() => useStaffLookup(), { wrapper });
    await waitFor(() => expect(result.current(staffRef('DD'))).not.toBeNull());
    expect(result.current(null)).toBeNull();
    expect(result.current(undefined)).toBeNull();
    expect(result.current('00000000-0000-4000-8000-00000000dead')).toBeNull();
  });
});
