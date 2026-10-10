import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import {
  CREDIT_DIRECTION_TONES,
  CREDIT_STATUS_TONES,
  TONE_CLASSES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { LedgerByCell } from '@/shared/components/LedgerCells/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import {
  PAYMENTS_KEYS,
  PAYMENTS_NS,
  PENDING_TABLE_ID,
} from '../../../payments.constants.ts';
import {
  creditReason,
  creditStateLabel,
  isOpenCredit,
  PendingAmountCell,
  PendingRefCell,
  PendingSinceCell,
  PendingStateCell,
  PendingWayCell,
  PendingWhoCell,
  PendingWhyCell,
  useCreditSince,
} from '../../components/PendingCells/index.ts';

/** The table's row as the meta line and the phone key read it. */
const rowOf = (original: unknown) => original as CreditRow;

/**
 * The Pending columns (KICKOFF §6.9 Pending; `payments.md:45–46`): Ref · Who ·
 * Which way · Amount · Why · Since · State · By (who added it — the team
 * directory's name for `created_by_membership_id`, as the ledger's By), their
 * tracks and what each folds to. Who carries the meta line, Amount is the
 * phone's key column; none sorts (newest first).
 */
function usePendingColumns(): ColumnDef<DataTableFeatures, CreditRow>[] {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const since = useCreditSince();
  return [
    {
      id: 'ref',
      accessorKey: 'seq',
      header: t(PAYMENTS_KEYS.columns.ref),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <PendingRefCell seq={row.original.seq} />,
      meta: {
        track: '86px',
        kind: 'id',
        foldValue: (original) => displayId.pendingCredit(rowOf(original).seq),
      },
    },
    {
      id: 'who',
      accessorKey: 'partyName',
      header: t(PAYMENTS_KEYS.columns.who),
      enableSorting: false,
      cell: ({ row }) => <PendingWhoCell credit={row.original} />,
      meta: {
        track: 'minmax(200px,1.4fr)',
        primary: true,
        // A patient's chip draws the avatar; a supplier or party is plain text.
        drawsAvatar: (original) => rowOf(original).patientId !== null,
      },
    },
    {
      id: 'way',
      accessorKey: 'direction',
      header: t(PAYMENTS_KEYS.columns.way),
      enableSorting: false,
      cell: ({ row }) => <PendingWayCell credit={row.original} />,
      meta: {
        track: '130px',
        kind: 'badges',
        foldValue: (original) => {
          const { direction } = rowOf(original);
          return {
            value: t(PAYMENTS_KEYS.pending.ways[direction]),
            dotClassName: TONE_CLASSES[CREDIT_DIRECTION_TONES[direction]].fill,
          };
        },
      },
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: t(PAYMENTS_KEYS.columns.amount),
      enableSorting: false,
      cell: ({ row }) => <PendingAmountCell credit={row.original} />,
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => formatRupees(rowOf(original).amount),
      },
    },
    {
      id: 'why',
      accessorKey: 'reason',
      header: t(PAYMENTS_KEYS.columns.why),
      enableSorting: false,
      cell: ({ row }) => <PendingWhyCell credit={row.original} />,
      meta: {
        track: 'minmax(200px,1.5fr)',
        foldValue: (original) => creditReason(rowOf(original), t),
      },
    },
    {
      id: 'since',
      accessorKey: 'createdAt',
      header: t(PAYMENTS_KEYS.columns.since),
      enableSorting: false,
      cell: ({ row }) => <PendingSinceCell credit={row.original} />,
      meta: { track: '100px', foldValue: (original) => since(rowOf(original)) },
    },
    {
      id: 'state',
      accessorKey: 'status',
      header: t(PAYMENTS_KEYS.columns.state),
      enableSorting: false,
      cell: ({ row }) => <PendingStateCell credit={row.original} />,
      meta: {
        track: '120px',
        kind: 'badges',
        foldValue: (original) => {
          const credit = rowOf(original);
          return {
            value: creditStateLabel(credit, t),
            dotClassName: TONE_CLASSES[CREDIT_STATUS_TONES[credit.status]].fill,
          };
        },
      },
    },
    {
      id: 'by',
      accessorFn: (row) => row.by?.name ?? '',
      header: t(PAYMENTS_KEYS.columns.by),
      enableSorting: false,
      cell: ({ row }) => <LedgerByCell row={row.original} />,
      // The 28px people pill folds to nothing, as the ledger's (H:4115).
      meta: { track: '130px', foldValue: () => null },
    },
  ];
}

/** The edge tone of a credit: Give / Take ink while open, grey once settled (`payments.md:48`). */
export function pendingRowTone(credit: Pick<CreditRow, 'status' | 'direction'>): Tone {
  return isOpenCredit(credit) ? CREDIT_DIRECTION_TONES[credit.direction] : 'stone';
}

/** The Pending table instance: the loaded cursor pages, keyed by the credit's id; no sort. */
export function usePendingTable(rows: readonly CreditRow[]) {
  const columns = usePendingColumns();
  const visibility = useHiddenColumns(PENDING_TABLE_ID, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as CreditRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
