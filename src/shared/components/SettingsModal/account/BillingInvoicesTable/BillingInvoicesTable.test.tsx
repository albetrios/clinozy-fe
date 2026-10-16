import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

const INVOICE = {
  id: 'in_1',
  invoiceNumber: 'INV-1',
  status: 'paid' as const,
  amountDue: 1200,
  amountPaid: 1200,
  currency: 'usd',
  createdAt: '2026-01-01T00:00:00.000Z',
  dueDate: '2026-02-01T00:00:00.000Z',
  hostedInvoiceUrl: 'https://stripe.test/in_1' as string | null,
  invoicePdfUrl: null as string | null,
};

const { useBillingInvoices } = vi.hoisted(() => ({ useBillingInvoices: vi.fn() }));
vi.mock('@/shared/hooks/useBillingInvoices/index.ts', () => ({ useBillingInvoices }));

function answer(data: unknown) {
  useBillingInvoices.mockReturnValue({
    data,
    isPending: false,
    isLoading: false,
    isError: false,
    status: 'success',
    fetchStatus: 'idle',
  });
}

beforeEach(() => {
  answer([INVOICE]);
});

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

  it('opens the hosted invoice in a new tab, without handing it the opener', () => {
    renderTable();
    const link = screen.getByRole('link', { name: 'View invoice' });
    expect(link).toHaveAttribute('href', 'https://stripe.test/in_1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('offers the PDF as "Download PDF", ahead of the hosted page', () => {
    answer([{ ...INVOICE, invoicePdfUrl: 'https://stripe.test/in_1.pdf' }]);
    renderTable();
    const link = screen.getByRole('link', { name: 'Download PDF' });
    expect(link).toHaveAttribute('href', 'https://stripe.test/in_1.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: 'View invoice' })).not.toBeInTheDocument();
  });

  it('reads date, total, status and the action — no due date — with the date as a day', () => {
    renderTable();
    // Each row reads date · total · status · action; the due date (Feb 1) went with its column.
    expect(screen.getByTestId('billing-invoices-table')).toHaveTextContent(
      'Jan 1, 2026$12.00paidView invoice',
    );
    expect(screen.getByTestId('billing-invoices-table')).not.toHaveTextContent('Feb 1');
  });

  it('offers no link for an invoice with neither', () => {
    answer([{ ...INVOICE, hostedInvoiceUrl: null, invoicePdfUrl: null }]);
    renderTable();
    expect(screen.queryByTestId('billing-invoice-view')).not.toBeInTheDocument();
  });

  it('says so when there are no invoices yet', () => {
    answer([]);
    renderTable();
    expect(screen.getByText('No invoices yet.')).toBeInTheDocument();
  });

  it('says so when the invoices cannot be loaded', () => {
    useBillingInvoices.mockReturnValue({
      data: undefined,
      isPending: false,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      status: 'error',
      fetchStatus: 'idle',
      refetch: vi.fn(),
    });
    renderTable();
    expect(
      screen.getByText("Couldn't load invoices. Please try again."),
    ).toBeInTheDocument();
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
