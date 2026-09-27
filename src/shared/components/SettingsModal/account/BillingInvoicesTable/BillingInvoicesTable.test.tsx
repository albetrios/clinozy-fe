import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('@/shared/hooks/useBillingInvoices/index.ts', () => ({
  useBillingInvoices: () => ({
    data: [
      {
        id: 'in_1',
        invoiceNumber: 'INV-1',
        status: 'paid' as const,
        amountDue: 1200,
        amountPaid: 1200,
        currency: 'usd',
        createdAt: '2026-01-01T00:00:00.000Z',
        dueDate: '2026-02-01T00:00:00.000Z',
        hostedInvoiceUrl: 'https://stripe.test/in_1',
        invoicePdfUrl: null,
      },
    ],
    isPending: false,
    isLoading: false,
    isError: false,
  }),
}));

import { BillingInvoicesTable } from './BillingInvoicesTable.tsx';

function renderTable() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BillingInvoicesTable />
    </QueryClientProvider>,
  );
}

describe('BillingInvoicesTable', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderTable();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders invoice rows', () => {
    renderTable();
    expect(screen.getByTestId('billing-invoices-table')).toBeInTheDocument();
    expect(screen.getByTestId('billing-invoice-view')).toBeInTheDocument();
  });

  it('renders nothing when disabled (no subscription — was a stuck skeleton)', () => {
    // Regression: the card always rendered but the query was disabled, so the
    // QueryBoundary sat on a permanent loading skeleton.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const { queryByTestId } = render(
      <QueryClientProvider client={client}>
        <BillingInvoicesTable enabled={false} />
      </QueryClientProvider>,
    );
    expect(queryByTestId('billing-invoices-card')).not.toBeInTheDocument();
  });
});
