import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { CreditRow } from '@/shared/api/app/credits-contracts.ts';
import {
  CREDIT_DIRECTION_TONES,
  CREDIT_STATUS_TONES,
  TONE_CLASSES,
} from '@/shared/app/app-tones.ts';
import { MoneyCell, PersonChip, TonePill } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import { useMedicalDates } from '../../../shared/components/MedicalCells/medical-dates.ts';

const rowOf = (original: unknown) => original as CreditRow;

/**
 * Medical › Credits' "With customers" columns (clinozy-be MD32): Who (the person over "CR-12") ·
 * Which way · Amount · Left · State · Since — the Payments room's Pending, on the store's sales.
 * Money in rupees; newest first.
 */
export function useCustomerCreditColumns(): ColumnDef<DataTableFeatures, CreditRow>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const formatRupees = useRupeeFormat();
  const dates = useMedicalDates();
  const keys = MEDICAL_KEYS.credits;
  const noValue = t(MEDICAL_KEYS.table.noValue);
  return [
    {
      id: 'who',
      accessorKey: 'partyName',
      header: t(keys.columns.who),
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <PersonChip
          name={row.original.partyName}
          sub={displayId.pendingCredit(row.original.seq)}
          tone={row.original.patientId ? 'sage' : 'sky'}
          patient={row.original.patientId !== null}
        />
      ),
      meta: { track: 'minmax(220px,1.4fr)', kind: 'person' },
    },
    {
      id: 'way',
      accessorKey: 'direction',
      header: t(keys.columns.way),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={CREDIT_DIRECTION_TONES[row.original.direction]}>
          {t(keys.ways[row.original.direction])}
        </TonePill>
      ),
      meta: {
        track: '140px',
        kind: 'badges',
        foldValue: (original) => t(keys.ways[rowOf(original).direction]),
      },
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: t(keys.columns.amount),
      enableSorting: false,
      cell: ({ row }) => (
        <MoneyCell rupees={row.original.amount} className="font-semibold" />
      ),
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => formatRupees(rowOf(original).amount),
      },
    },
    {
      id: 'left',
      accessorKey: 'left',
      header: t(keys.columns.left),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.left > 0 ? (
          <MoneyCell rupees={row.original.left} />
        ) : (
          <span className="text-muted-foreground">{noValue}</span>
        ),
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => {
          const left = rowOf(original).left;
          return left > 0 ? formatRupees(left) : null;
        },
      },
    },
    {
      id: 'state',
      accessorKey: 'status',
      header: t(keys.columns.state),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={CREDIT_STATUS_TONES[row.original.status]} dot>
          {t(keys.customerStates[row.original.status])}
        </TonePill>
      ),
      meta: {
        track: '120px',
        kind: 'badges',
        foldValue: (original) => {
          const status = rowOf(original).status;
          return {
            value: t(keys.customerStates[status]),
            dotClassName: TONE_CLASSES[CREDIT_STATUS_TONES[status]].fill,
          };
        },
      },
    },
    {
      id: 'since',
      accessorKey: 'createdAt',
      header: t(keys.columns.since),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate">
          {dates.when(row.original.createdAt)}
        </span>
      ),
      meta: {
        track: '120px',
        foldValue: (original) => dates.when(rowOf(original).createdAt),
      },
    },
  ];
}
