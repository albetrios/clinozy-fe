import { Outlet, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { useRoomFilters } from '@/shared/components/RoomToolbar/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { PenLine, SquareCheck } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { validateMedicalSearch } from '../medical.search.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { useMedicalSummary, useMrList } from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import type { MrRow } from '../shared/medical-contracts.ts';
import { filtersOf } from '../shared/medical-filters.ts';
import { useMrColumns } from './hooks/useMrColumns/index.ts';
import { mrFilterKey, mrParamsOf } from './mrs.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.mrs;

/** The MRs Filters (`medical.md:119`): Created alone. */
const { fields: MR_FILTER_FIELDS } = filtersOf({});

/**
 * Medical › MRs (KICKOFF §6.7; `medical.md:105–119`): the Medical toolbar over
 * the medical representatives — the makers each represents and their visits.
 * A row opens Edit MR; "Log visit" opens Log MR visit. No status edge.
 */
export function MrsPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = mrParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(MR_FILTER_FIELDS);

  const list = useMrList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, mrFilterKey(params));
  const summary = useMedicalSummary('mrs', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useMrColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const canEdit = access.isResolved && access.can('medical', 'edit');
  const canCreate = access.isResolved && access.can('medical', 'create');
  const keys = MEDICAL_KEYS.mrs;

  const rowActions = (mr: MrRow): DataTableRowAction[] => [
    ...(canEdit
      ? [
          {
            id: 'log-visit',
            label: t(keys.rowActions.logVisit),
            icon: SquareCheck,
            onSelect: () => nav.mrVisit(mr.id),
          },
        ]
      : []),
    {
      id: 'edit',
      label: t(keys.rowActions.edit),
      icon: PenLine,
      onSelect: () => nav.mrEdit(mr.id),
    },
  ];

  return (
    <section data-testid="medical-mrs-page" className="flex min-h-0 flex-1 flex-col">
      <MedicalToolbar
        tab="mrs"
        table={table}
        filters={{ fields: MR_FILTER_FIELDS, copy: {} }}
      />
      <MedicalTable
        tab="mrs"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(keys.empty)}
        emptyAction={
          canCreate
            ? { label: t(MEDICAL_KEYS.create.mr), onSelect: () => nav.create('mrs') }
            : undefined
        }
        recordsLabel={t(keys.records)}
        countLabel={summary ? t(keys.count, { count: summary.total }) : undefined}
        minWidth={980}
        onRowClick={(mr) => nav.mrEdit(mr.id)}
        rowActions={rowActions}
        exportName="mrs.csv"
        avatar
      />
      <Outlet />
    </section>
  );
}
