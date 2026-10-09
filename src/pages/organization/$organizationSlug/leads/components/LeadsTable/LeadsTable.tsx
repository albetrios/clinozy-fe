'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getVisibleLeafColumns()` …) on objects that keep their identity across
// state changes, so React Compiler memoisation would serve stale answers.

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { LEAD_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TABLE_ID } from '../../leads.constants.ts';
import type { LeadsTableInstance } from './leads-table-columns.tsx';
import { LeadsTableContext, type LeadsTableContextValue } from './leads-table-context.ts';
import { type LeadsColumnId, leadTableMinWidth } from './leads-table-layout.ts';

/** The Leads list virtualises above 40 rows — its own threshold (H:4157). */
const VIRTUALIZE_ABOVE = 40;
/** A row before it is measured: 32px avatar, 10px above and below, the hairline (`leads.md:35`). */
const ROW_HEIGHT = 53;

/** Props for {@link LeadsTable}. */
export interface LeadsTableProps {
  table: LeadsTableInstance;
  /** The team, "me", the hold and the row actions the cells read. */
  context: LeadsTableContextValue;
  /** The list's paging and refresh state (`useLeadList`). */
  list: {
    isRefreshing: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
  };
  /** The lead open in the drawer — its row keeps the `muted` fill. */
  openLeadId: string | null;
  /** A row was clicked, or Enter pressed on the j / k row. */
  onOpen: (lead: LeadRecord) => void;
  /** No rows: the first load's bars, or the empty line. */
  empty: ReactNode;
}

/**
 * The Leads list (KICKOFF §6.3 Table; `leads.md:26–41`): the shared table with
 * no fold and no selection, rows 53px with the 3px edge in the status's dot
 * colour, the open lead's row on `muted`; j / k move a row focus and Enter
 * opens it (`_patterns.md:273`). Narrower than 830px (all six columns) the
 * rows scroll sideways inside the card and the header follows; a phone
 * wraps each row instead. Infinite scroll over cursor pages of 50, windowed
 * above 40 rows, "All leads loaded" at the end.
 */
export function LeadsTable({
  table,
  context,
  list,
  openLeadId,
  onOpen,
  empty,
}: LeadsTableProps) {
  const { t } = useTranslation(LEADS_NS);
  const visible = table
    .getVisibleLeafColumns()
    .map((column) => column.id as LeadsColumnId);
  return (
    <LeadsTableContext.Provider value={context}>
      <DataTable
        table={table}
        tableId={LEADS_TABLE_ID}
        label={t(LEADS_KEYS.manifest.title)}
        recordsLabel={t(LEADS_KEYS.list.records)}
        phoneLayout="wrap"
        keyboardNav
        virtualizeAbove={VIRTUALIZE_ABOVE}
        rowHeight={ROW_HEIGHT}
        minWidth={leadTableMinWidth(visible)}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        fetchNextPage={list.fetchNextPage}
        refreshing={list.isRefreshing}
        onRowClick={(row) => onOpen(row.original)}
        isRowActive={(row) => row.original.id === openLeadId}
        getRowTone={(row) => LEAD_STATUS_TONES[row.original.status]}
        // The lead rows' edge is the status dot colour (`leads.md:35`, H:5643).
        rowEdge="dot"
        empty={empty}
        className="m-(--room-card-margin) flex-1"
      />
    </LeadsTableContext.Provider>
  );
}
