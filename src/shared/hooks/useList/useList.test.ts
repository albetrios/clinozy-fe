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
const { useList } = await import('./useList.ts');

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useList', () => {
  beforeEach(() => {
    vi.mocked(dataProvider.getList).mockReset();
  });

  it('calls dataProvider.getList with the resource name and params', async () => {
    vi.mocked(dataProvider.getList).mockResolvedValue({
      data: [{ id: 'u1' }],
      total: 1,
    });

    const { result } = renderHook(
      () => useList('users', { pagination: { page: 1, perPage: 10 } }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dataProvider.getList).toHaveBeenCalledWith('users', {
      pagination: { page: 1, perPage: 10 },
    });
    expect(result.current.data).toEqual({ data: [{ id: 'u1' }], total: 1 });
  });
});
