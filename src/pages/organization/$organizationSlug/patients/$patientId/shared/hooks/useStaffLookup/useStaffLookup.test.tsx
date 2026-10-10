import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import {
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  teamDoctor,
} from '@/tests/utils/appointment-doubles.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { useStaffLookup } from './useStaffLookup.ts';

// The team (`GET /app/memberships`) and the signed-in member's own membership.
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));

/** The signed-in member: Riya, the front desk. */
const RIYA = teamDoctor({
  id: 'mem_riya00000000000000000',
  userId: 'usr_test',
  name: 'Riya Shah',
  initials: 'RS',
  tone: 'blush',
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The lookup once the team and the member's membership have answered. */
async function renderLookup() {
  const view = renderHook(() => useStaffLookup(), { wrapper });
  await waitFor(() => expect(view.result.current('')).not.toBeNull());
  return view;
}

beforeEach(() => {
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchTeamDirectory).mockResolvedValue([DOCTOR_ARJUN, DOCTOR_NISHA, RIYA]);
  vi.mocked(findMyMembershipId).mockResolvedValue(RIYA.id);
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useStaffLookup', () => {
  it('names the team member a record points at, in their tone', async () => {
    const { result } = await renderLookup();
    expect(result.current(DOCTOR_NISHA.id)).toEqual({
      id: DOCTOR_NISHA.id,
      name: 'Nisha Shah',
      initials: 'NS',
      tone: 'sky',
    });
    expect(result.current(DOCTOR_ARJUN.id)).toMatchObject({
      name: 'Arjun Rao',
      tone: 'sage',
    });
  });

  it('reads a record still on its way (no author yet) as the signed-in member', async () => {
    const { result } = await renderLookup();
    expect(result.current('')).toEqual({
      id: RIYA.id,
      name: 'Riya Shah',
      initials: 'RS',
      tone: 'blush',
    });
    expect(findMyMembershipId).toHaveBeenCalled();
  });

  it('knows nobody for no id, or someone no longer on the team', async () => {
    const { result } = await renderLookup();
    expect(result.current(null)).toBeNull();
    expect(result.current(undefined)).toBeNull();
    expect(result.current('mem_dev00000000000000000')).toBeNull();
  });

  it('knows nobody while the team loads', () => {
    vi.mocked(fetchTeamDirectory).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useStaffLookup(), { wrapper });
    expect(result.current(DOCTOR_NISHA.id)).toBeNull();
    expect(result.current('')).toBeNull();
  });

  it('names nobody for an unsaved record when the member has no membership here', async () => {
    vi.mocked(findMyMembershipId).mockResolvedValue(null);
    const { result } = renderHook(() => useStaffLookup(), { wrapper });
    await waitFor(() => expect(result.current(DOCTOR_NISHA.id)).not.toBeNull());
    await waitFor(() => expect(findMyMembershipId).toHaveBeenCalled());
    expect(result.current('')).toBeNull();
  });
});
