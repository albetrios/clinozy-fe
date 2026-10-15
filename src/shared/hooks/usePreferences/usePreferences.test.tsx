import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as preferencesApi from '@/shared/api/app/preferences-api.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import { usePreferences } from './usePreferences.ts';

const { reportErrorMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn() }));
vi.mock('@/shared/errors/errorHandler.ts', () => ({ reportError: reportErrorMock }));
const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  signInTestMember();
});

afterEach(() => {
  vi.restoreAllMocks();
  reportErrorMock.mockReset();
});

describe('usePreferences', () => {
  it('serves the defaults, then the stored record', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.preferences.pinnedSections).toEqual([
      'appointments',
      'leads',
      'patients',
      'payments',
      'branches',
    ]);
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('shows a change at once and saves it without a toast', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => result.current.update({ pinnedSections: ['today', 'tasks'] }));
    await waitFor(() =>
      expect(result.current.preferences.pinnedSections).toEqual(['today', 'tasks']),
    );
    await waitFor(async () =>
      expect((await preferencesApi.fetchMyPreferences()).pinnedSections).toEqual([
        'today',
        'tasks',
      ]),
    );
    expect(notifyMock.success).not.toHaveBeenCalled();
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('reads and saves nothing for a visitor who is not signed in — the sign-in pages', async () => {
    useAuthStore.setState({ user: null });
    const fetch = vi.spyOn(preferencesApi, 'fetchMyPreferences');
    const save = vi.spyOn(preferencesApi, 'saveMyPreferences');
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.isPending).toBe(false);
    act(() => result.current.update({ pinnedSections: ['today'] }));
    expect(result.current.preferences).toEqual(preferencesApi.DEFAULT_APP_PREFERENCES);
    expect(fetch).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps each organization’s record apart', async () => {
    const { result, rerender } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => result.current.update({ pinnedSections: ['tasks'] }));
    await waitFor(() =>
      expect(result.current.preferences.pinnedSections).toEqual(['tasks']),
    );
    act(() => useOrganizationStore.getState().setOrganization('org_other', 'other'));
    rerender();
    expect(result.current.preferences.pinnedSections).not.toEqual(['tasks']);
  });

  it('retries a failed save silently, then rolls back and reports it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi
      .spyOn(preferencesApi, 'saveMyPreferences')
      .mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.update({ branchFilter: ['b1'] }));
    await waitFor(() => expect(result.current.preferences.branchFilter).toEqual(['b1']));

    await vi.runAllTimersAsync();
    await waitFor(() => expect(result.current.preferences.branchFilter).toEqual([]));
    expect(save).toHaveBeenCalledTimes(4);
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.error).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
