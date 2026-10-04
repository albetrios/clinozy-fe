import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
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
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import { useMedicalDates } from '../../../shared/components/MedicalCells/index.ts';
import type { SaleRow } from '../../../shared/medical-contracts.ts';
import { SALE_STATUS_TONES } from '../../../shared/medical-tones.ts';

const rowOf = (original: unknown) => original as SaleRow;

/**
 * The Sales columns (KICKOFF §6.7 Tables; `medical.md:29–36`): Sale ·
 * Customer · Medicines · Bill · Margin (hidden) · Status · When — tracks
 * `80px minmax(200px,1.3fr) minmax(220px,1.6fr) 100px 100px 100px 120px`. On a
 * phone the Customer leads, the Bill is the key and the meta line reads
 * Medicines, Status, When and "#983". The column ids are the URL's sort keys.
 */
export function useSaleColumns(): ColumnDef<DataTableFeatures, SaleRow>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const formatPaise = usePaiseFormat();
  const dates = useMedicalDates();
  const keys = MEDICAL_KEYS.sales;

  const medicines = (sale: SaleRow) =>
    sale.lines.map((line) => t(keys.line, { name: line.name, qty: line.qty })).join(', ');
  const batches = (sale: SaleRow) => {
    const numbers = sale.lines.flatMap((line) => (line.batchNo ? [line.batchNo] : []));
    return numbers.length > 0 ? t(keys.batches, { batches: numbers.join(', ') }) : '';
  };
  const margin = (sale: SaleRow) => sale.bill - sale.cost;

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
        const patient = customer.kind === 'patient';
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
          text={<MoneyCell paise={row.original.bill} />}
          sub={
            row.original.returned > 0
              ? t(keys.returned, { amount: formatPaise(row.original.returned) })
              : undefined
          }
          subTone="lav"
        />
      ),
      meta: {
        track: '100px',
        align: 'end',
        foldValue: (original) => formatPaise(rowOf(original).bill),
      },
    },
    {
      id: 'margin',
      accessorFn: (sale) => margin(sale),
      header: t(keys.columns.margin),
      enableSorting: false,
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <TextCell
            align="end"
            text={<MoneyCell paise={margin(sale)} />}
            sub={
              sale.bill > 0
                ? t(MEDICAL_KEYS.table.percent, {
                    value: Math.round((margin(sale) / sale.bill) * 100),
                  })
                : undefined
            }
            subTone="sage"
          />
        );
      },
      meta: {
        track: '100px',
        align: 'end',
        defaultHidden: true,
        foldValue: (original) => formatPaise(margin(rowOf(original))),
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: t(keys.columns.status),
      enableSorting: false,
      // "Returned" (lav, its refund in the tooltip) before Paid / Unpaid (`medical.md:29`).
      cell: ({ row }) => {
        const sale = row.original;
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
                    {t(keys.refunded, { amount: formatPaise(sale.returned) })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <TonePill tone={SALE_STATUS_TONES[sale.status]} dot>
              {t(keys.statuses[sale.status])}
            </TonePill>
          </span>
        );
      },
      meta: {
        track: '100px',
        kind: 'badges',
        foldValue: (original) => {
          const sale = rowOf(original);
          const tone = SALE_STATUS_TONES[sale.status];
          const labels = [
            ...(sale.returns.length > 0 ? [t(keys.statuses.returned)] : []),
            t(keys.statuses[sale.status]),
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
        track: '120px',
        foldValue: (original) => dates.when(rowOf(original).soldAt),
      },
    },
  ];
}
