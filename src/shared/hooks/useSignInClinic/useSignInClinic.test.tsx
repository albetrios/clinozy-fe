import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as UserSettingsApiModule from '@/shared/api/user-settings-api.ts';
import type { MyOrganizationSummary } from '@/shared/tenancy/my-organization-summaries.ts';

import { useSignInClinic } from './useSignInClinic.ts';

/** clinozy-be's copy of the pinned clinic (`GET` / `PATCH /users/me/settings`). */
const server = vi.hoisted(() => ({
  pinned: null as string | null,
  fetchSignInClinic: vi.fn(),
  saveSignInClinic: vi.fn(),
}));
vi.mock('@/shared/api/user-settings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof UserSettingsApiModule>()),
  fetchSignInClinic: server.fetchSignInClinic,
  saveSignInClinic: server.saveSignInClinic,
}));

function organization(
  id: string,
  name: string,
  type: 'TEAM' | 'PERSONAL' = 'TEAM',
): MyOrganizationSummary {
  return {
    id,
    name,
    slug: type === 'TEAM' ? name.toLowerCase() : null,
    type,
    status: 'ACTIVE',
    logoUrl: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    isActive: false,
  };
}

const organizations = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('@/shared/tenancy/my-organization-summaries.ts', () => ({
  useMyOrganizationSummaries: () => ({ data: organizations.list }),
}));

const { notifyMock, reportErrorMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn() },
  reportErrorMock: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/errors/errorHandler.ts', () => ({ reportError: reportErrorMock }));

const OJAS = organization('org_ojas', 'Ojas');
const DEMO = organization('org_demo', 'Demo');
const PERSONAL = organization('org_personal', 'Personal', 'PERSONAL');

function renderSignInClinic() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSignInClinic(), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
  server.pinned = null;
  organizations.list = [PERSONAL, OJAS, DEMO];
  server.fetchSignInClinic.mockImplementation(async () => server.pinned);
  server.saveSignInClinic.mockImplementation(async (next: string | null) => {
    server.pinned = next;
    return next;
  });
});

describe('useSignInClinic', () => {
  it('offers the clinics only — never the personal workspace — and starts on automatic', async () => {
    const { result } = renderSignInClinic();

    await waitFor(() => expect(result.current.canChoose).toBe(true));
    expect(result.current.clinics.map((clinic) => clinic.id)).toEqual([
      'org_ojas',
      'org_demo',
    ]);
    expect(result.current.pinnedId).toBeNull();
  });

  it('has nothing to choose with a single clinic', async () => {
    organizations.list = [PERSONAL, OJAS];
    const { result } = renderSignInClinic();

    await waitFor(() => expect(server.fetchSignInClinic).toHaveBeenCalled());
    expect(result.current.canChoose).toBe(false);
  });

  it('shows a pin at once, saves it and names the clinic in the toast', async () => {
    const { result } = renderSignInClinic();
    await waitFor(() => expect(result.current.canChoose).toBe(true));

    act(() => result.current.choose('org_demo'));

    await waitFor(() => expect(result.current.pinnedId).toBe('org_demo'));
    await waitFor(() => expect(server.pinned).toBe('org_demo'));
    expect(notifyMock.success).toHaveBeenCalledWith(expect.stringContaining('Demo'));
  });

  it('goes back to automatic with null', async () => {
    server.pinned = 'org_ojas';
    const { result } = renderSignInClinic();
    await waitFor(() => expect(result.current.pinnedId).toBe('org_ojas'));

    act(() => result.current.choose(null));

    await waitFor(() => expect(server.pinned).toBeNull());
    expect(result.current.pinnedId).toBeNull();
    expect(notifyMock.success).toHaveBeenCalledTimes(1);
  });

  it('puts the previous choice back when the save fails, and says why', async () => {
    server.pinned = 'org_ojas';
    server.saveSignInClinic.mockRejectedValue(new Error('offline'));
    const { result } = renderSignInClinic();
    await waitFor(() => expect(result.current.pinnedId).toBe('org_ojas'));

    act(() => result.current.choose('org_demo'));

    await waitFor(() => expect(reportErrorMock).toHaveBeenCalledTimes(1));
    expect(result.current.pinnedId).toBe('org_ojas');
    expect(notifyMock.error).toHaveBeenCalledTimes(1);
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('reads a pin that is not among the clinics as automatic', async () => {
    server.pinned = 'org_gone';
    const { result } = renderSignInClinic();

    await waitFor(() => expect(result.current.canChoose).toBe(true));
    expect(result.current.pinnedId).toBeNull();
  });
});
