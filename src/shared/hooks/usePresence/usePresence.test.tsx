import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Presence } from '@/shared/api/app/app-schema.ts';
import type * as PresenceApiModule from '@/shared/api/app/presence-api.ts';

import { usePresence } from './usePresence.ts';

/** clinozy-be's copy of my presence (`GET /users/me`, `PUT /users/me/presence`). */
const server = vi.hoisted(() => ({
  presence: 'online' as Presence,
  fetchMyPresence: vi.fn(),
  saveMyPresence: vi.fn(),
}));
vi.mock('@/shared/api/app/presence-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PresenceApiModule>()),
  fetchMyPresence: server.fetchMyPresence,
  saveMyPresence: server.saveMyPresence,
}));

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
  server.presence = 'online';
  server.fetchMyPresence.mockReset();
  server.fetchMyPresence.mockImplementation(async () => server.presence);
  server.saveMyPresence.mockReset();
  server.saveMyPresence.mockImplementation(async (next: Presence) => {
    server.presence = next;
    return next;
  });
  reportErrorMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePresence', () => {
  it('shows a change at once and saves it', async () => {
    const { result } = renderPresence();
    await waitFor(() => expect(result.current.presence).toBe('online'));
    act(() => result.current.setPresence('away'));
    await waitFor(() => expect(result.current.presence).toBe('away'));
    await waitFor(() => expect(server.presence).toBe('away'));
  });

  it('retries a failed save, then rolls back and reports it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const save = server.saveMyPresence;
    save.mockRejectedValue(new Error('offline'));
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
