import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { roomFiltersOf, useRoomFilters } from '@/shared/components/RoomToolbar/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { PenLine, SquareCheck, Trash } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { validateMedicalSearch } from '../medical.search.ts';
import {
  MedicalDeleteConfirm,
  type MedicalDeleteTarget,
} from '../shared/components/MedicalDeleteConfirm/index.ts';
import { MedicalStackHost } from '../shared/components/MedicalStackHost/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { MrDrawer } from '../shared/components/MrDrawer/index.ts';
import {
  type MedicalDialogRouteState,
  useMedicalDialogRoute,
} from '../shared/hooks/useMedicalDialogRoute/index.ts';
import { useMedicalSummary, useMrList } from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import {
  type MedicalStack,
  useMedicalStack,
} from '../shared/hooks/useMedicalStack/index.ts';
import { fetchMedicalRep, medicalQueryKeys } from '../shared/medical-api.ts';
import type { MrRow } from '../shared/medical-contracts.ts';
import { MEDICAL_DRAWER_KEYS } from '../shared/medical-drawers.constants.ts';
import { MrVisitDrawer } from './components/MrVisitDrawer/index.ts';
import { useMrColumns } from './hooks/useMrColumns/index.ts';
import { mrFilterKey, mrParamsOf, mrSummaryParamsOf } from './mrs.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.mrs;

/** The MRs Filters (`medical.md:119`): Created alone. */
const { fields: MR_FILTER_FIELDS } = roomFiltersOf({});

/**
 * A row's actions (`medical.md:113`): "Log visit" (Edit), Edit, and Delete
 * (Delete) with its reason confirm.
 */
function useMrActions() {
  const { t } = useTranslation(MEDICAL_NS);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const [deleting, setDeleting] = useState<MedicalDeleteTarget | null>(null);
  const canEdit = access.isResolved && access.can('medical', 'edit');
  const canDelete = access.isResolved && access.can('medical', 'delete');
  const keys = MEDICAL_KEYS.mrs.rowActions;

  const rowActions = (mr: MrRow): DataTableRowAction[] => [
    ...(canEdit
      ? [
          {
            id: 'log-visit',
            label: t(keys.logVisit),
            icon: SquareCheck,
            onSelect: () => nav.mrVisit(mr.id),
          },
        ]
      : []),
    {
      id: 'edit',
      label: t(keys.edit),
      icon: PenLine,
      onSelect: () => nav.mrEdit(mr.id),
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            label: t(keys.delete),
            icon: Trash,
            destructive: true,
            onSelect: () => setDeleting({ kind: 'mr', id: mr.id, name: mr.name }),
          },
        ]
      : []),
  ];

  const confirm = (
    <MedicalDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
  );
  return { rowActions, confirm };
}

/**
 * The drawers the MRs URL opens: New / Edit MR for `create/` and
 * `$mrId/edit/`, Log MR visit for `$mrId/visits/create/`, and a maker stacked
 * on the MR drawer.
 */
function MrDrawers({
  dialog,
  close,
  stack,
}: Pick<MedicalDialogRouteState<MrRow>, 'dialog' | 'close'> & { stack: MedicalStack }) {
  const visiting = dialog.kind === 'record' && dialog.action === 'visits/create';
  return (
    <>
      <MrDrawer
        {...(dialog.kind === 'record' && !visiting
          ? { mode: 'edit' as const, mr: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create' ? { name: dialog.prefill.name } : undefined,
            })}
        open={dialog.kind === 'create' || (dialog.kind === 'record' && !visiting)}
        onClose={close}
        openChild={stack.open}
      />
      <MrVisitDrawer
        open={visiting}
        onClose={close}
        mr={dialog.kind === 'record' ? dialog.record : undefined}
      />
      <MedicalStackHost stack={stack} />
    </>
  );
}

/**
 * Medical › MRs (KICKOFF §6.7; `medical.md:105–119`) on clinozy-be (`GET
 * /app/medical-reps`): the Medical toolbar over the medical representatives —
 * the makers each represents, their last visit and samples, and the next
 * visit the server marks overdue. A row opens Edit MR; "Log visit" opens Log
 * MR visit; Delete asks for a reason. No status edge. This page opens the MR
 * drawer for `create/` and `$mrId/edit/`, and Log MR visit for
 * `$mrId/visits/create/`. A first read that fails shows in place with Retry.
 */
export function MrsPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = mrParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(MR_FILTER_FIELDS);
  const stack = useMedicalStack();
  const { rowActions, confirm } = useMrActions();
  const { dialog, close } = useMedicalDialogRoute({
    tab: 'mrs',
    param: 'mrId',
    queryKey: medicalQueryKeys.mr,
    fetchRecord: fetchMedicalRep,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.mr),
  });

  const list = useMrList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, mrFilterKey(params));
  const summary = useMedicalSummary('mrs', mrSummaryParamsOf(params)).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useMrColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });
  const failed = list.isError && rows.length === 0 && !loading;

  const canCreate = access.isResolved && access.can('medical', 'create');
  const keys = MEDICAL_KEYS.mrs;

  return (
    <section data-testid="medical-mrs-page" className="flex min-h-0 flex-1 flex-col">
      <MedicalToolbar
        tab="mrs"
        table={table}
        filters={{ fields: MR_FILTER_FIELDS, copy: {} }}
      />
      {failed ? (
        <RetryError
          message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
          onRetry={list.refetch}
        />
      ) : (
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
      )}
      <MrDrawers dialog={dialog} close={close} stack={stack} />
      {confirm}
      <Outlet />
    </section>
  );
}
