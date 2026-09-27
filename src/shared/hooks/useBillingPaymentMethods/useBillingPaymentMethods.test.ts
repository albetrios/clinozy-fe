import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/billing-api.ts', () => ({
  listBillingPaymentMethods: vi.fn(),
}));

const { listBillingPaymentMethods } = await import('@/shared/api/billing-api.ts');
const { useBillingPaymentMethods } = await import('./useBillingPaymentMethods.ts');

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useBillingPaymentMethods', () => {
  beforeEach(() => {
    vi.mocked(listBillingPaymentMethods).mockReset();
  });

  it('loads payment methods from the billing API', async () => {
    vi.mocked(listBillingPaymentMethods).mockResolvedValue([]);
    const { result } = renderHook(() => useBillingPaymentMethods(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listBillingPaymentMethods).toHaveBeenCalled();
  });
});
