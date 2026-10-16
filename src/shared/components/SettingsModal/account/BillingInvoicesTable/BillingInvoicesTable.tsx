import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { BillingInvoice } from '@/shared/api/billing-contracts.ts';
import { type PillTone, TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { QueryBoundary } from '@/shared/components/QueryBoundary/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import { PLAN_DATE } from '@/shared/components/SettingsModal/account/BillingPlanComparison/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useBillingInvoices } from '@/shared/hooks/useBillingInvoices/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Receipt } from '@/shared/icons/index.ts';

const INVOICE_KEYS = SETTINGS_KEYS.panels.billing.invoices;

/** An invoice status's pill tone, in the rooms' words: paid sage, owed blush, else plain. */
function invoiceStatusTone(status: BillingInvoice['status']): PillTone {
  if (status === 'paid') return 'sage';
  if (status === 'open' || status === 'uncollectible') return 'blush';
  return 'neutral';
}

function InvoicesTable({ invoices }: { invoices: BillingInvoice[] }) {
  const { t } = useTranslation(SETTINGS_NS);
  const { formatCurrency, formatDate } = useLocaleFormat();

  const columns = useMemo<ColumnDef<DataTableFeatures, BillingInvoice>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: t(INVOICE_KEYS.columns.date),
        cell: ({ row }) => formatDate(row.original.createdAt, PLAN_DATE),
      },
      {
        id: 'total',
        header: t(INVOICE_KEYS.columns.total),
        cell: ({ row }) => formatCurrency(row.original.amountDue, row.original.currency),
      },
      {
        accessorKey: 'status',
        header: t(INVOICE_KEYS.columns.status),
        cell: ({ row }) => (
          <TonePill
            tone={invoiceStatusTone(row.original.status)}
            dot
            className="capitalize"
          >
            {row.original.status}
          </TonePill>
        ),
      },
      {
        id: 'actions',
        header: t(INVOICE_KEYS.columns.actions),
        // As Claude's invoices read: the PDF when the provider gives one, else its hosted page.
        cell: ({ row }) => {
          const { invoicePdfUrl, hostedInvoiceUrl } = row.original;
          const url = invoicePdfUrl ?? hostedInvoiceUrl;
          if (!url) return <span className="text-muted-foreground text-body">—</span>;
          return (
            <Button variant="link" size="sm" asChild data-testid="billing-invoice-view">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-auto px-0 underline"
              >
                {t(invoicePdfUrl ? INVOICE_KEYS.downloadPdf : INVOICE_KEYS.view)}
              </a>
            </Button>
          );
        },
      },
    ],
    [formatCurrency, formatDate, t],
  );

  const table = useTable({
    features: dataTableFeatures,
    data: invoices,
    columns,
  });

  return (
    <div data-testid="billing-invoices-table">
      {/* The design's table card, kept edged on a phone inside the settings card. */}
      <DataTable
        table={table}
        empty={
          <EmptyState
            variant="compact"
            tone="peach"
            icon={<Receipt />}
            title={t(INVOICE_KEYS.empty)}
            className="py-8"
          />
        }
        className="max-md:rounded-xl max-md:border-x"
      />
    </div>
  );
}

/** Invoice history for the active team workspace. */
export function BillingInvoicesTable({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation(SETTINGS_NS);
  const query = useBillingInvoices(enabled);

  // Hide the whole card when there is no subscription to invoice against. The
  // guard is about the card, not about the query: QueryBoundary tells a disabled
  // query apart from a loading one by itself now (X-5).
  if (!enabled) return null;

  return (
    <SettingsCard
      data-testid="billing-invoices-card"
      title={t(INVOICE_KEYS.title)}
      description={t(INVOICE_KEYS.description)}
    >
      <QueryBoundary
        query={query}
        errorMessage={t(INVOICE_KEYS.loadFailed)}
        title={t(INVOICE_KEYS.title)}
      >
        {(invoices) => <InvoicesTable invoices={invoices} />}
      </QueryBoundary>
    </SettingsCard>
  );
}
