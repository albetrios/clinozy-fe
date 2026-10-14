import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  IdPill,
  MoneyCell,
  PersonChip,
  TextCell,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import { useMedicalDates } from '../../../shared/components/MedicalCells/index.ts';
import type { SaleRow } from '../../../shared/medical-contracts.ts';
import { SALE_STATUS_TONES } from '../../../shared/medical-tones.ts';
import { salePaymentOf } from '../useSaleActions/index.ts';

const rowOf = (original: unknown) => original as SaleRow;

/**
 * The Sales columns (KICKOFF §6.7 Tables; `medical.md:29–36`): Sale ·
 * Customer · Medicines · Bill · Margin (hidden) · Status · When — tracks
 * `80px minmax(200px,1.3fr) minmax(220px,1.6fr) 100px 100px 100px 128px`. On a
 * phone the Customer leads, the Bill is the key and the meta line reads
 * Medicines, Status, When and "#983". The column ids are the URL's sort keys
 * (Sale, Customer, Bill — the API's). Money is the API's rupees; the margin,
 * its percent, the due and what came back are the server's, never summed here.
 */
export function useSaleColumns(): ColumnDef<DataTableFeatures, SaleRow>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const formatRupees = useRupeeFormat();
  const dates = useMedicalDates();
  const keys = MEDICAL_KEYS.sales;

  const medicines = (sale: SaleRow) =>
    sale.lines.map((line) => t(keys.line, { name: line.name, qty: line.qty })).join(', ');
  const batches = (sale: SaleRow) => {
    const numbers = sale.lines.flatMap((line) => (line.batchNo ? [line.batchNo] : []));
    return numbers.length > 0 ? t(keys.batches, { batches: numbers.join(', ') }) : '';
  };
  return [
    {
      id: 'seq',
      accessorKey: 'seq',
      header: t(keys.columns.seq),
      enableHiding: false,
      cell: ({ row }) => <IdPill>{`#${row.original.seq}`}</IdPill>,
      meta: {
        track: '80px',
        kind: 'id',
        foldValue: (original) => `#${rowOf(original).seq}`,
      },
    },
    {
      id: 'customer',
      accessorFn: (sale) => sale.customer?.name ?? '',
      header: t(keys.columns.customer),
      enableHiding: false,
      cell: ({ row }) => {
        const customer = row.original.customer;
        if (!customer) return null;
        const patient = customer.patientId !== null;
        return (
          <PersonChip
            name={customer.name}
            sub={t(patient ? keys.patient : keys.contact)}
            tone={patient ? 'sage' : 'stone'}
            patient={patient}
          />
        );
      },
      meta: { track: 'minmax(200px,1.3fr)', kind: 'person' },
    },
    {
      id: 'medicines',
      accessorFn: (sale) => medicines(sale),
      header: t(keys.columns.medicines),
      enableSorting: false,
      cell: ({ row }) => (
        <TextCell text={medicines(row.original)} sub={batches(row.original)} />
      ),
      meta: { track: 'minmax(220px,1.6fr)' },
    },
    {
      id: 'bill',
      accessorKey: 'bill',
      header: t(keys.columns.bill),
      cell: ({ row }) => (
        <TextCell
          align="end"
          weight="semibold"
          text={<MoneyCell rupees={row.original.bill} />}
          sub={
            row.original.returned > 0
              ? t(keys.returned, { amount: formatRupees(row.original.returned) })
              : undefined
          }
          subTone="lav"
        />
      ),
      meta: {
        track: '100px',
        align: 'end',
        foldValue: (original) => formatRupees(rowOf(original).bill),
      },
    },
    {
      id: 'margin',
      accessorKey: 'margin',
      header: t(keys.columns.margin),
      enableSorting: false,
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <TextCell
            align="end"
            text={<MoneyCell rupees={sale.margin} />}
            sub={
              sale.marginPct === null
                ? undefined
                : t(MEDICAL_KEYS.table.percent, { value: Math.round(sale.marginPct) })
            }
            subTone="sage"
          />
        );
      },
      meta: {
        track: '100px',
        align: 'end',
        defaultHidden: true,
        foldValue: (original) => formatRupees(rowOf(original).margin),
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: t(keys.columns.status),
      enableSorting: false,
      // "Returned" (lav, its refund in the tooltip) before Paid / Unpaid (`medical.md:29`): the
      // server's status reads "returned" once anything came back; Paid / Unpaid is its due.
      cell: ({ row }) => {
        const sale = row.original;
        const payment = salePaymentOf(sale);
        return (
          <span className="flex min-w-0 flex-wrap gap-1">
            {sale.returns.length > 0 ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TonePill tone="lav" tabIndex={0}>
                      {t(keys.statuses.returned)}
                    </TonePill>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t(keys.refunded, { amount: formatRupees(sale.returned) })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <TonePill tone={SALE_STATUS_TONES[payment]} dot>
              {t(keys.statuses[payment])}
            </TonePill>
          </span>
        );
      },
      meta: {
        track: '100px',
        kind: 'badges',
        foldValue: (original) => {
          const sale = rowOf(original);
          const payment = salePaymentOf(sale);
          const tone = SALE_STATUS_TONES[payment];
          const labels = [
            ...(sale.returns.length > 0 ? [t(keys.statuses.returned)] : []),
            t(keys.statuses[payment]),
          ];
          return { value: labels.join(', '), dotClassName: TONE_CLASSES[tone].fill };
        },
      },
    },
    {
      id: 'when',
      accessorKey: 'soldAt',
      header: t(keys.columns.when),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate tabular-nums">
          {dates.when(row.original.soldAt)}
        </span>
      ),
      meta: {
        // 128px, not the design's 120 (`medical.md:29`): the 12-hour
        // "Yesterday 11:53 AM" is 125px at 13px.
        track: '128px',
        foldValue: (original) => dates.when(rowOf(original).soldAt),
      },
    },
  ];
}
