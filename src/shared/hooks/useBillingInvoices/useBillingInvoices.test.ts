import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/billing-api.ts', () => ({
  listBillingInvoices: vi.fn(),
}));

const { listBillingInvoices } = await import('@/shared/api/billing-api.ts');
const { useBillingInvoices } = await import('./useBillingInvoices.ts');

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useBillingInvoices', () => {
  beforeEach(() => {
    vi.mocked(listBillingInvoices).mockReset();
  });

  it('loads invoices from the billing API', async () => {
    vi.mocked(listBillingInvoices).mockResolvedValue([]);
    const { result } = renderHook(() => useBillingInvoices(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listBillingInvoices).toHaveBeenCalled();
  });
});
