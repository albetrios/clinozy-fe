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
const { useUpdate } = await import('./useUpdate.ts');

function makeContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useUpdate', () => {
  beforeEach(() => {
    vi.mocked(dataProvider.update).mockReset();
  });

  it('passes id and data to dataProvider.update', async () => {
    vi.mocked(dataProvider.update).mockResolvedValue({ id: 'u1', name: 'A2' });
    const { wrapper } = makeContext();
    const { result } = renderHook(() => useUpdate('users'), { wrapper });

    result.current.mutate({ id: 'u1', data: { name: 'A2' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dataProvider.update).toHaveBeenCalledWith('users', 'u1', { name: 'A2' });
  });
});
