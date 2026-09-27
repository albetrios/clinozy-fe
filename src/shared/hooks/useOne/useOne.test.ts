import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataProvider } from '@/core/data-provider/dataProvider.ts';

vi.mock('@/core/data-provider/index.ts', () => ({
  dataProvider: {
    getList: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } satisfies DataProvider,
}));

const { dataProvider } = await import('@/core/data-provider/index.ts');
const { useOne } = await import('./useOne.ts');

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useOne', () => {
  beforeEach(() => {
    vi.mocked(dataProvider.getOne).mockReset();
  });

  it('fetches the record when id is defined', async () => {
    vi.mocked(dataProvider.getOne).mockResolvedValue({ id: 'u1', name: 'Alice' });
    const { result } = renderHook(() => useOne('users', 'u1'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(dataProvider.getOne).toHaveBeenCalledWith('users', 'u1');
    expect(result.current.data).toEqual({ id: 'u1', name: 'Alice' });
  });

  it('is disabled when id is undefined', () => {
    const { result } = renderHook(() => useOne('users', undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(dataProvider.getOne).not.toHaveBeenCalled();
  });
});
