import {
  type ColumnDef,
  functionalUpdate,
  type OnChangeFn,
  type ReactTable,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TABLE_ID } from '../../leads.constants.ts';
import {
  LeadInterestPills,
  LeadSourcePill,
  LeadStatusPill,
} from '../LeadFields/index.ts';
import { leadsColumn } from './leads-table-layout.ts';
import { LeadPersonCell, LeadTeamCell, LeadUpdatedCell } from './LeadsTableCells.tsx';

/** A Leads column definition. */
type LeadsColumnDef = ColumnDef<DataTableFeatures, LeadRecord>;

/**
 * The Leads columns (`leads.md:32–34`; `ldColsVM`, H:4176): Lead (always
 * shown) · Status · Source · Interested in · Team · Updated, on the prototype's
 * tracks. Lead sorts A–Z, Status in pipeline order, Source by name, Updated —
 * the person's latest activity — newest first → off; Interested in and Team
 * don't sort. The server sorts (`manualSorting`): the column ids are the list
 * read's sort keys.
 */
function useLeadsColumns(now: Date): LeadsColumnDef[] {
  const { t } = useTranslation(LEADS_NS);
  return useMemo(() => {
    const label = (key: string) => t(key);
    return [
      {
        id: 'name',
        accessorKey: 'name',
        header: label(LEADS_KEYS.list.columns.lead),
        enableHiding: false,
        meta: {
          track: leadsColumn('name').track,
          kind: 'person',
          primary: true,
          locked: true,
        },
        cell: ({ row }) => <LeadPersonCell lead={row.original} />,
      },
      {
        id: 'status',
        accessorFn: (lead) => lead.status,
        header: label(LEADS_KEYS.list.columns.status),
        meta: { track: leadsColumn('status').track },
        cell: ({ row }) => <LeadStatusPill lead={row.original} />,
      },
      {
        id: 'source',
        accessorFn: (lead) => lead.source,
        header: label(LEADS_KEYS.list.columns.source),
        meta: { track: leadsColumn('source').track },
        cell: ({ row }) => <LeadSourcePill source={row.original.source} />,
      },
      {
        id: 'interests',
        accessorFn: (lead) => lead.interests,
        header: label(LEADS_KEYS.list.columns.interests),
        enableSorting: false,
        meta: { track: leadsColumn('interests').track },
        cell: ({ row }) => <LeadInterestPills interests={row.original.interests} />,
      },
      {
        id: 'team',
        accessorFn: (lead) => lead.ownerId,
        header: label(LEADS_KEYS.list.columns.team),
        enableSorting: false,
        meta: { track: leadsColumn('team').track },
        cell: ({ row }) => <LeadTeamCell lead={row.original} />,
      },
      {
        id: 'activity',
        accessorKey: 'lastActivityAt',
        header: label(LEADS_KEYS.list.columns.updated),
        meta: {
          track: leadsColumn('activity').track,
          align: 'end',
          sortStartsDescending: true,
        },
        cell: ({ row }) => <LeadUpdatedCell lead={row.original} now={now} />,
      },
    ] satisfies LeadsColumnDef[];
  }, [t, now]);
}

/** The Leads table instance. */
export type LeadsTableInstance = ReactTable<DataTableFeatures, LeadRecord>;

/**
 * The Leads table: the rows as the server sorted them (`manualSorting` — the
 * URL's `sort`), the columns this device hid (`useHiddenColumns`), one row
 * per lead id. The toolbar's Columns chooser and the table share it.
 */
export function useLeadsTable({
  rows,
  sorting,
  onSortingChange,
  now,
}: {
  rows: LeadRecord[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  now: Date;
}): LeadsTableInstance {
  const columns = useLeadsColumns(now);
  const visibility = useHiddenColumns(LEADS_TABLE_ID, columns);
  const changeSorting: OnChangeFn<SortingState> = (updater) =>
    onSortingChange(functionalUpdate(updater, sorting));
  return useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (lead) => lead.id,
    manualSorting: true,
    manualPagination: true,
    state: { sorting, columnVisibility: visibility.columnVisibility },
    onSortingChange: changeSorting,
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
