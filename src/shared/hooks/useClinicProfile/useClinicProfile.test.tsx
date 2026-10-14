import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClinicApiModule from '@/shared/api/app/clinic-api.ts';
import {
  type ClinicProfile,
  clinicQueryKeys,
  type ClinicSettings,
} from '@/shared/api/app/clinic-api.ts';
import { offeringQueryKeys } from '@/shared/api/app/offerings-api.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { meContextQueryKey } from '@/shared/tenancy/me-context.ts';

const api = vi.hoisted(() => ({
  fetchClinicProfile: vi.fn(),
  updateClinicProfile: vi.fn(),
  fetchClinicSettings: vi.fn(),
  updateClinicSettings: vi.fn(),
}));
vi.mock('@/shared/api/app/clinic-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ClinicApiModule>()),
  ...api,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  useClinicProfile,
  useClinicSettings,
  useUpdateClinicProfile,
  useUpdateClinicSettings,
} from './useClinicProfile.ts';

const PROFILE: ClinicProfile = {
  name: 'Acme Skin Clinic',
  specialties: ['skin'],
  timezone: 'Asia/Kolkata',
  createdAt: '2026-10-01T04:30:00Z',
  updatedAt: '2026-10-13T04:30:00Z',
};

const SETTINGS: ClinicSettings = {
  reminderHour: 16,
  leadHoldDays: 3,
  retargetAfterDays: 90,
  updatedAt: '2026-10-13T04:30:00Z',
};

function renderWithClient<T>(hook: () => T) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(hook, { wrapper }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  api.fetchClinicProfile.mockResolvedValue(PROFILE);
  api.fetchClinicSettings.mockResolvedValue(SETTINGS);
});

describe('useClinicProfile', () => {
  it('reads the clinic under the organization’s key', async () => {
    const { result, client } = renderWithClient(() => useClinicProfile());
    await waitFor(() => expect(result.current.data).toEqual(PROFILE));
    expect(client.getQueryData(clinicQueryKeys.profile('org_test'))).toEqual(PROFILE);
  });

  it('reads nothing when turned off or outside an organization', async () => {
    const off = renderWithClient(() => useClinicProfile({ enabled: false }));
    await act(async () => {});
    expect(off.result.current.fetchStatus).toBe('idle');

    useOrganizationStore.getState().clearOrganization();
    const outside = renderWithClient(() => useClinicProfile());
    await act(async () => {});
    expect(outside.result.current.fetchStatus).toBe('idle');
    expect(api.fetchClinicProfile).not.toHaveBeenCalled();
  });
});

describe('useUpdateClinicProfile', () => {
  it('saves with an idempotency key and reads the clinic, the offerings’ default and me/context again', async () => {
    api.updateClinicProfile.mockResolvedValue({
      ...PROFILE,
      specialties: ['skin', 'hair'],
    });
    const { result, client } = renderWithClient(() =>
      useUpdateClinicProfile({ notifyOnError: false }),
    );
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({ specialties: ['skin', 'hair'] });
    });

    expect(api.updateClinicProfile).toHaveBeenCalledWith({
      change: { specialties: ['skin', 'hair'] },
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: clinicQueryKeys.profile('org_test'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: offeringQueryKeys.specialties('org_test'),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: meContextQueryKey });
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('toasts its success message unless the caller reports it', async () => {
    api.updateClinicProfile.mockResolvedValue(PROFILE);
    const shown = renderWithClient(() =>
      useUpdateClinicProfile({ successMessage: 'Saved' }),
    );
    await act(async () => {
      await shown.result.current.mutateAsync({ timezone: 'Asia/Kolkata' });
    });
    expect(notify.success).toHaveBeenCalledWith('Saved');

    vi.mocked(notify.success).mockClear();
    const quiet = renderWithClient(() =>
      useUpdateClinicProfile({ successMessage: 'Saved', suppressSuccessToast: true }),
    );
    await act(async () => {
      await quiet.result.current.mutateAsync({ timezone: 'Asia/Kolkata' });
    });
    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe('useClinicSettings', () => {
  it('reads the operating values under the organization’s key', async () => {
    const { result, client } = renderWithClient(() => useClinicSettings());
    await waitFor(() => expect(result.current.data).toEqual(SETTINGS));
    expect(client.getQueryData(clinicQueryKeys.settings('org_test'))).toEqual(SETTINGS);
  });

  it('reads nothing when turned off', async () => {
    const { result } = renderWithClient(() => useClinicSettings({ enabled: false }));
    await act(async () => {});
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.fetchClinicSettings).not.toHaveBeenCalled();
  });
});

describe('useUpdateClinicSettings', () => {
  it('saves with an idempotency key and reads the values again', async () => {
    api.updateClinicSettings.mockResolvedValue({ ...SETTINGS, reminderHour: 9 });
    const { result, client } = renderWithClient(() => useUpdateClinicSettings());
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({ reminderHour: 9 });
    });

    expect(api.updateClinicSettings).toHaveBeenCalledWith({
      change: { reminderHour: 9 },
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: clinicQueryKeys.settings('org_test'),
    });
  });

  it('toasts a failure by default', async () => {
    api.updateClinicSettings.mockRejectedValue(new Error('offline'));
    const { result } = renderWithClient(() => useUpdateClinicSettings());

    await act(async () => {
      await result.current.mutateAsync({ leadHoldDays: 5 }).catch(() => undefined);
    });

    expect(notify.error).toHaveBeenCalled();
  });
});
