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
const { useDelete } = await import('./useDelete.ts');

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

describe('useDelete', () => {
  beforeEach(() => {
    vi.mocked(dataProvider.delete).mockReset();
  });

  it('calls dataProvider.delete with the resource and id', async () => {
    vi.mocked(dataProvider.delete).mockResolvedValue(undefined);
    const { wrapper } = makeContext();
    const { result } = renderHook(() => useDelete('users'), { wrapper });

    result.current.mutate('u1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dataProvider.delete).toHaveBeenCalledWith('users', 'u1');
  });
});
