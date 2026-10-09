import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/leads-fixture-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchFixtureLead: vi.fn(),
  fetchFixtureLeadViewer: vi.fn(),
  updateFixtureLead: vi.fn(),
}));
import {
  fetchFixtureLead,
  fetchFixtureLeadViewer,
  updateFixtureLead,
} from '@/shared/api/clinic/leads-fixture-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-fixture-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import {
  useFixtureLead,
  useFixtureLeadViewer,
  useUpdateFixtureLead,
} from './useFixtureLeads.ts';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const lead = { id: 'fixture-lead', name: 'Anaya Desai' } as LeadRecord;

describe('the fixture leads the rooms still on fixtures read', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ user: null });
  });

  it('reads one fixture lead, and stays idle without an id', async () => {
    vi.mocked(fetchFixtureLead).mockResolvedValue(lead);
    const { result, rerender } = renderHook(({ id }) => useFixtureLead(id), {
      wrapper,
      initialProps: { id: undefined as string | undefined },
    });
    expect(fetchFixtureLead).not.toHaveBeenCalled();

    rerender({ id: lead.id });

    await waitFor(() => expect(result.current.data).toEqual(lead));
    expect(fetchFixtureLead).toHaveBeenCalledWith(lead.id);
  });

  it('reads the signed-in member by their sign-in email', async () => {
    const viewer = { id: 'staff-me' } as StaffProfile;
    vi.mocked(fetchFixtureLeadViewer).mockResolvedValue(viewer);
    useAuthStore.setState({
      user: { id: 'usr_me', email: 'me@clinic.test', role: 'user' } as AuthUser,
    });

    const { result } = renderHook(() => useFixtureLeadViewer(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(viewer));
    expect(fetchFixtureLeadViewer).toHaveBeenCalledWith('me@clinic.test');
  });

  it('edits a fixture lead with the patch it is given', async () => {
    vi.mocked(updateFixtureLead).mockResolvedValue(lead);
    const { result } = renderHook(() => useUpdateFixtureLead(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ id: lead.id, patch: { name: 'Anaya D.' } }),
    );

    expect(updateFixtureLead).toHaveBeenCalledWith(lead.id, { name: 'Anaya D.' });
  });
});
