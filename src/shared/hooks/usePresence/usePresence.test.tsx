import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as presenceApi from '@/shared/api/clinic/presence-api.ts';

import { usePresence } from './usePresence.ts';

const { reportErrorMock } = vi.hoisted(() => ({ reportErrorMock: vi.fn() }));
vi.mock('@/shared/errors/errorHandler.ts', () => ({ reportError: reportErrorMock }));

function renderPresence() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePresence(), { wrapper });
}

beforeEach(() => {
  presenceApi.resetPresenceFixture();
  reportErrorMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePresence', () => {
  it('shows a change at once and saves it', async () => {
    const { result } = renderPresence();
    await waitFor(() => expect(result.current.presence).toBe('online'));
    act(() => result.current.setPresence('away'));
    await waitFor(() => expect(result.current.presence).toBe('away'));
    expect(await presenceApi.fetchMyPresence()).toBe('away');
  });

  it('retries a failed save, then rolls back and reports it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = vi
      .spyOn(presenceApi, 'saveMyPresence')
      .mockRejectedValue(new Error('offline'));
    const { result } = renderPresence();
    await waitFor(() => expect(result.current.presence).toBe('online'));
    act(() => result.current.setPresence('busy'));
    await waitFor(() => expect(result.current.presence).toBe('busy'));
    await vi.runAllTimersAsync();
    await waitFor(() => expect(result.current.presence).toBe('online'));
    expect(save).toHaveBeenCalledTimes(4);
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
