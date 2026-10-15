import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
  type DataTableFoldValue,
} from '@/shared/components/DataTable/index.ts';
import { useHoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS } from '../../branches.constants.ts';
import {
  branchAddressLine,
  branchDefaultsLines,
  BranchHoursCell,
  BranchLinesCell,
  BranchNameCell,
  branchPhone,
  BranchStatusCell,
  BranchTeamCell,
} from '../../components/BranchCells/index.ts';
import type { BranchRow } from '../useBranchRows/index.ts';

/** The table's row as the meta line and the phone key read it. */
const rowOf = (original: unknown) => original as BranchRow;

/**
 * The Branches room's columns (KICKOFF §6.12 Branches table; `users.md:83–93`;
 * H:5196–5205): Branch · Address · Contact · Opening hours · Team · Default
 * people · Status, every one shown (no Columns button) and none sortable — the
 * main branch first, then as opened. Address is the primary cell: the fold
 * keeps Branch, Address and Contact longest (820px folds four, 1024px three)
 * into its meta line, and on a phone the Branch chip leads while the address
 * block carries the rest one per line at the end. Team folds to nothing: its
 * avatars have no text.
 */
function useBranchColumns(): ColumnDef<DataTableFeatures, BranchRow>[] {
  const { t } = useTranslation(BRANCHES_NS);
  const format = useHoursFormat();
  const hours = (row: BranchRow) =>
    row.branch.workingDays.length
      ? format.hours(row.branch.workingDays, row.branch.opensAt, row.branch.closesAt)
      : '';
  const statusFold = (row: BranchRow): DataTableFoldValue => ({
    value: row.branch.active
      ? t(BRANCHES_KEYS.status.open)
      : t(BRANCHES_KEYS.status.closed),
    dotClassName: row.branch.active ? TONE_CLASSES.sage.fill : 'bg-disabled',
  });

  return [
    {
      id: 'branch',
      accessorFn: (row) => row.branch.name,
      header: t(BRANCHES_KEYS.columns.branch),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <BranchNameCell branch={row.original.branch} />,
      // The phone row's key column: it leads, and never folds.
      meta: { track: 'minmax(130px,.8fr)', kind: 'badges', priority: 1 },
    },
    {
      id: 'address',
      accessorFn: (row) => row.branch.addressLine1,
      header: t(BRANCHES_KEYS.columns.address),
      enableSorting: false,
      cell: ({ row }) => (
        <BranchLinesCell
          value={row.original.branch.addressLine1}
          sub={branchAddressLine(row.original.branch)}
        />
      ),
      meta: { track: 'minmax(220px,1.5fr)', primary: true },
    },
    {
      id: 'contact',
      accessorFn: (row) => row.branch.phone,
      header: t(BRANCHES_KEYS.columns.contact),
      enableSorting: false,
      cell: ({ row }) => (
        <BranchLinesCell
          value={branchPhone(row.original.branch)}
          sub={row.original.branch.email || undefined}
        />
      ),
      meta: {
        track: 'minmax(170px,1fr)',
        priority: 2,
        foldValue: (original) => branchPhone(rowOf(original).branch),
      },
    },
    {
      id: 'hours',
      accessorFn: (row) => hours(row),
      header: t(BRANCHES_KEYS.columns.hours),
      enableSorting: false,
      cell: ({ row }) => <BranchHoursCell value={hours(row.original)} />,
      meta: {
        track: 'minmax(170px,1fr)',
        priority: 3,
        foldValue: (original) => hours(rowOf(original)) || null,
      },
    },
    {
      id: 'team',
      accessorFn: (row) => row.team.length,
      header: t(BRANCHES_KEYS.columns.team),
      enableSorting: false,
      cell: ({ row }) => <BranchTeamCell team={row.original.team} />,
      meta: { track: 'minmax(130px,.8fr)', priority: 4, foldValue: () => null },
    },
    {
      id: 'defaults',
      accessorFn: (row) => row.defaults.length,
      header: t(BRANCHES_KEYS.columns.defaults),
      enableSorting: false,
      cell: ({ row }) => {
        const lines = branchDefaultsLines(row.original, t);
        return lines ? (
          <BranchLinesCell value={lines.value} sub={lines.sub || undefined} />
        ) : (
          <BranchLinesCell value={t(BRANCHES_KEYS.notSet)} quiet />
        );
      },
      meta: {
        track: 'minmax(190px,1.1fr)',
        priority: 6,
        foldValue: (original) =>
          branchDefaultsLines(rowOf(original), t)?.value ?? t(BRANCHES_KEYS.notSet),
      },
    },
    {
      id: 'status',
      accessorFn: (row) => row.branch.active,
      header: t(BRANCHES_KEYS.columns.status),
      enableSorting: false,
      cell: ({ row }) => <BranchStatusCell active={row.original.branch.active} />,
      meta: {
        track: '90px',
        kind: 'badges',
        priority: 5,
        foldValue: (original) => statusFold(rowOf(original)),
      },
    },
  ];
}

/**
 * The Branches table instance: every column shown, nothing sorted in the
 * header — the rows come in the list's order — keyed by branch id.
 */
export function useBranchesTable(rows: readonly BranchRow[]) {
  const columns = useBranchColumns();
  return useTable({
    features: dataTableFeatures,
    data: rows as BranchRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.branch.id,
  });
}
