import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  PAYMENT_KIND_TONES,
  PAYMENT_MODE_TONES,
  TONE_CLASSES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import {
  LEDGER_KEYS,
  LEDGER_NS,
  LedgerAmountCell,
  LedgerByCell,
  LedgerModeCell,
  ledgerModes,
  ledgerModesLabel,
  LedgerPartyCell,
  LedgerRefCell,
  ledgerWhat,
  LedgerWhatCell,
  LedgerWhenCell,
} from '@/shared/components/LedgerCells/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

/** The table's row as the meta line and the phone key read it. */
const rowOf = (original: unknown) => original as LedgerRow;

/**
 * The ledger's columns (KICKOFF §6.9 Ledger; `payments.md:29–30`): Ref · What ·
 * When · From / to · Mode · Amount · By, their tracks, and what each folds to.
 * When carries the meta line from `md` up — as the prototype folds at 820,
 * What · When · Amount — and From / to on a phone, with Amount the key column
 * (the build fixes the prototype's newest-row pick, AMBER). None sorts: the
 * ledger runs newest first (`payments.md:31`).
 */
function useLedgerColumns(): ColumnDef<DataTableFeatures, LedgerRow>[] {
  const { t } = useTranslation(LEDGER_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatRupees = useRupeeFormat();
  const clock = useClinicClock();
  const phone = useViewportTier() === 'phone';

  return [
    {
      id: 'ref',
      accessorKey: 'seq',
      header: t(LEDGER_KEYS.columns.ref),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <LedgerRefCell seq={row.original.seq} />,
      meta: {
        track: '96px',
        kind: 'id',
        foldValue: (original) => displayId.payment(rowOf(original).seq),
      },
    },
    {
      id: 'what',
      accessorKey: 'direction',
      header: t(LEDGER_KEYS.columns.what),
      enableSorting: false,
      cell: ({ row }) => <LedgerWhatCell row={row.original} />,
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => {
          const what = ledgerWhat(rowOf(original));
          return { value: t(what.labelKey), dotClassName: TONE_CLASSES[what.tone].fill };
        },
      },
    },
    {
      id: 'when',
      accessorKey: 'paidAt',
      header: t(LEDGER_KEYS.columns.when),
      enableSorting: false,
      cell: ({ row }) => <LedgerWhenCell row={row.original} />,
      meta: {
        track: '150px',
        primary: !phone,
        foldValue: (original) => clock.moment(rowOf(original).paidAt),
      },
    },
    {
      id: 'party',
      accessorKey: 'partyName',
      header: t(LEDGER_KEYS.columns.party),
      enableSorting: false,
      cell: ({ row }) => <LedgerPartyCell row={row.original} />,
      meta: {
        track: 'minmax(240px,1.8fr)',
        primary: phone,
        // A patient's chip draws the avatar; a payee is plain text.
        drawsAvatar: (original) => rowOf(original).patientId !== null,
        foldValue: (original) => rowOf(original).partyName,
      },
    },
    {
      id: 'mode',
      accessorFn: (row) => ledgerModes(row).join(','),
      header: t(LEDGER_KEYS.columns.mode),
      enableSorting: false,
      cell: ({ row }) => <LedgerModeCell row={row.original} />,
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => {
          const modes = ledgerModes(rowOf(original));
          const first = modes[0];
          if (!first) return null;
          return {
            value: ledgerModesLabel(modes, tClinic),
            dotClassName: TONE_CLASSES[PAYMENT_MODE_TONES[first]].fill,
          };
        },
      },
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: t(LEDGER_KEYS.columns.amount),
      enableSorting: false,
      cell: ({ row }) => <LedgerAmountCell row={row.original} />,
      meta: {
        track: '120px',
        align: 'end',
        foldValue: (original) => {
          const row = rowOf(original);
          return t(
            row.direction === 'received'
              ? LEDGER_KEYS.ledger.received
              : LEDGER_KEYS.ledger.paid,
            { amount: formatRupees(row.amount) },
          );
        },
      },
    },
    {
      id: 'by',
      accessorFn: (row) => row.by?.name ?? '',
      header: t(LEDGER_KEYS.columns.by),
      enableSorting: false,
      cell: ({ row }) => <LedgerByCell row={row.original} />,
      // The 28px people pill folds to nothing (H:4115).
      meta: { track: '130px', foldValue: () => null },
    },
  ];
}

/** The edge tone of a row: the What tone (`payments.md:32`). */
export function ledgerRowTone(row: Pick<LedgerRow, 'kind'>) {
  return PAYMENT_KIND_TONES[row.kind];
}

/**
 * The ledger table instance (KICKOFF §6.9): the loaded cursor pages, keyed by
 * the entry's id; no column sorts; the Columns choice is a device pref under
 * the table's id (`useHiddenColumns` — the recommended set shows them all) —
 * the Payments ledger's, or Medical › Payments' own.
 */
export function useLedgerTable(rows: readonly LedgerRow[], tableId: string) {
  const columns = useLedgerColumns();
  const visibility = useHiddenColumns(tableId, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as LedgerRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
