import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { MeContext } from '@/shared/tenancy/me-context.ts';

const { fetchMeContextMock } = vi.hoisted(() => ({ fetchMeContextMock: vi.fn() }));
vi.mock('@/shared/tenancy/me-context.ts', () => ({
  fetchMeContext: fetchMeContextMock,
  meContextQueryKey: ['auth', 'me-context'],
}));

import { useMeContext } from './useMeContext.ts';

const CTX = {
  user: { firstName: 'Ada', email: 'ada@acme.test' },
  activeOrganization: { name: 'Acme', type: 'TEAM' },
  myPermissions: ['organization:read'],
  globalRole: null,
  organizations: [],
} as unknown as MeContext;

describe('useMeContext', () => {
  it('exposes the fetched session context', async () => {
    fetchMeContextMock.mockResolvedValue(CTX);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMeContext(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.user.firstName).toBe('Ada');
  });
});
