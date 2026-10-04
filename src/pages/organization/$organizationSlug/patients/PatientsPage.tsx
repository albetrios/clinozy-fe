import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv, toCsv } from '@/lib/csv.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPatientCreate } from '@/lib/routes/index.ts';
import type { PatientRow, PatientView } from '@/shared/api/clinic/patients-contracts.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  type ClinicCommandNavigation,
  clinicCommandNavigation,
} from '@/shared/clinic/clinic-command-targets.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { PATIENT_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import {
  PatientDeleteConfirm,
  type PatientDeleteTarget,
} from '@/shared/components/PatientDeleteConfirm/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { useRoomFilters } from '@/shared/components/RoomToolbar/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePatientList } from '@/shared/hooks/usePatients/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import {
  FileIcon,
  PenLine,
  Receipt,
  Trash,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PatientsToolbar } from './components/PatientsToolbar/index.ts';
import { usePatientsTable } from './hooks/usePatientsTable/index.ts';
import {
  PATIENT_FILTER_FIELDS,
  PATIENTS_KEYS,
  PATIENTS_NS,
  PATIENTS_TABLE_ID,
} from './patients.constants.ts';
import {
  patientListParamsOf,
  PATIENTS_SEARCH_DEFAULTS,
  validatePatientsSearch,
} from './patients.search.ts';

/** One toast id: a second failure replaces the first instead of stacking. */
const LIST_ERROR_TOAST_ID = 'patients-list-error';

/** The exported file's name. */
const EXPORT_FILE_NAME = 'patients.csv';

/** How many placeholder rows stand in for the list while it loads. */
const SKELETON_ROWS = 8;

/**
 * What the table shows while the list is loading, empty or failed — the
 * in-place skeleton (first load; a new search or filter), the room's empty
 * state, or the filtered one (KICKOFF §6.5 States).
 */
function TableEmpty({
  loading,
  filtered,
  onClearFilters,
}: {
  loading: boolean;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation(PATIENTS_NS);
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        avatar
        label={t(PATIENTS_KEYS.manifest.title)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="sage" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="sage"
      icon={<Users />}
      title={t(PATIENTS_KEYS.empty.title)}
      description={t(PATIENTS_KEYS.empty.description)}
    />
  );
}

/**
 * The last rows the list loaded, kept while a read fails — "Showing the last
 * copy" (KICKOFF §6.0 List error) — and a 9s toast with "Retry".
 */
function useLastCopy(list: ReturnType<typeof usePatientList>): readonly PatientRow[] {
  const { t } = useTranslation([CLINIC_NS, ERRORS_NS]);
  const [lastCopy, setLastCopy] = useState<readonly PatientRow[]>(list.rows);
  const settled = !(list.isError || list.isPending);
  if (settled && list.rows !== lastCopy) setLastCopy(list.rows);

  const raiseError = useEffectEvent(() => {
    notify.error(t(CLINIC_KEYS.roomList.loadFailed, { ns: CLINIC_NS }), {
      id: LIST_ERROR_TOAST_ID,
      action: {
        label: t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS }),
        onClick: list.refetch,
      },
    });
  });
  useEffect(() => {
    if (list.isError) raiseError();
  }, [list.isError]);

  return list.isError && list.rows.length === 0 ? lastCopy : list.rows;
}

/**
 * The filter part of the list's params — a change to it (a search, "Apply
 * filter") shows the skeleton over the rows; a view or sort change keeps the
 * rows until the new page arrives (`patients.md:253`).
 */
function filterKeyOf(params: ReturnType<typeof patientListParamsOf>): string {
  return JSON.stringify([
    params.q,
    params.types,
    params.status,
    params.gender,
    params.conversion,
    params.created,
    params.followUp,
  ]);
}

/**
 * Patients room (KICKOFF §6.5; `patients.md`): the room toolbar — views,
 * search, Filters, saved views, Columns and "New patient" (a floating pill on
 * a phone) — over the shared table: folded columns on a tablet, rows with Due
 * as the key column on a phone, selection and the bulk bar from `md`, row
 * actions, infinite scroll over cursor pages. The view, search, filters and
 * sort live in the URL; the list read follows them. Its dialog route —
 * `create/` — renders nothing: this page reads the URL and opens the drawer.
 */
export function PatientsPage() {
  const { t } = useTranslation(PATIENTS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validatePatientsSearch(useSearch({ strict: false }));
  const params = patientListParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const tier = useViewportTier();
  const formatPaise = usePaiseFormat();
  const filters = useRoomFilters(PATIENT_FILTER_FIELDS);
  const [deleting, setDeleting] = useState<PatientDeleteTarget | null>(null);

  const list = usePatientList(params);
  const rows = useLastCopy(list);
  const filterKey = filterKeyOf(params);
  const [settledFilterKey, setSettledFilterKey] = useState(filterKey);
  if (!(list.isPending || list.isRefreshing) && settledFilterKey !== filterKey) {
    setSettledFilterKey(filterKey);
  }
  const loading = list.isPending || (list.isRefreshing && settledFilterKey !== filterKey);

  const go = (navigation: ClinicCommandNavigation) => void navigate(navigation);
  const can = (action: 'create' | 'edit' | 'delete') =>
    access.isResolved && access.can('patients', action);
  const canBill = access.isResolved && access.can('payments', 'create');
  const openFile = (patient: PatientRow) =>
    go(
      clinicCommandNavigation('patient', {
        organizationSlug,
        recordId: patient.id,
        // Activity open on tablet and desktop, closed on a phone (H:4687, §6.6).
        search: { activity: tier === 'phone' ? 'closed' : 'open' },
      }),
    );
  const editPatient = (patient: PatientRow) =>
    go(
      clinicCommandNavigation('patientEdit', { organizationSlug, recordId: patient.id }),
    );
  const openCreate = () =>
    void navigate({ ...organizationPatientCreate(organizationSlug), search: true });

  const contactActions = (patient: PatientRow): ContactCardActions => ({
    onOpenPatientFile: () => openFile(patient),
    onEditContact: can('edit') ? () => editPatient(patient) : undefined,
    onNewLead:
      access.isResolved && access.can('leads', 'create')
        ? () =>
            go({
              ...clinicCommandNavigation('newLead', { organizationSlug }),
              search: { name: patientName(patient), phone: patient.phone },
            })
        : undefined,
    onNewAppointment:
      access.isResolved && access.can('appointments', 'create')
        ? () =>
            go(
              clinicCommandNavigation('newAppointment', {
                organizationSlug,
                referrer: 'patients',
                search: { who: patient.id },
              }),
            )
        : undefined,
  });

  const table = usePatientsTable({
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
    contactActions,
  });

  const rowActions = (patient: PatientRow): DataTableRowAction[] => {
    const actions: DataTableRowAction[] = [];
    if (canBill) {
      actions.push({
        id: 'new-invoice',
        label: t(PATIENTS_KEYS.rowActions.newInvoice),
        icon: Receipt,
        onSelect: () =>
          go(
            clinicCommandNavigation('newInvoice', {
              organizationSlug,
              referrer: 'patients',
              search: { type: 'clinic', patient: patient.id },
            }),
          ),
      });
      if (patient.dueTotal > 0) {
        actions.push({
          id: 'collect',
          label: t(PATIENTS_KEYS.rowActions.collect, {
            amount: formatPaise(patient.dueTotal),
          }),
          icon: Wallet,
          onSelect: () =>
            go(
              clinicCommandNavigation('newReceipt', {
                organizationSlug,
                referrer: 'patients',
                search: { patient: patient.id },
              }),
            ),
        });
      }
    }
    if (can('edit')) {
      actions.push({
        id: 'edit',
        label: t(PATIENTS_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => editPatient(patient),
      });
    }
    if (can('delete')) {
      actions.push({
        id: 'delete',
        label: t(PATIENTS_KEYS.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => setDeleting({ id: patient.id, name: patientName(patient) }),
      });
    }
    return actions;
  };

  const bulkActions: DataTableBulkAction<PatientRow>[] =
    access.isResolved && access.canAbility('export')
      ? [
          {
            id: 'export',
            label: t(PATIENTS_KEYS.bulk.export),
            icon: FileIcon,
            onSelect: (selected) => {
              const columns = table.getVisibleLeafColumns();
              const headers = columns.map((column) =>
                typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : column.id,
              );
              const records = selected.map((patient) =>
                columns.map((column) => {
                  if (column.id === 'name') {
                    return `${patientName(patient)} · ${formatClinicPhone(patient.phone)}`;
                  }
                  const fold = column.columnDef.meta?.foldValue?.(patient);
                  return typeof fold === 'string' ? fold : (fold?.value ?? '');
                }),
              );
              downloadCsv(EXPORT_FILE_NAME, toCsv(headers, records));
              notify.success(t(PATIENTS_KEYS.bulk.exported, { count: selected.length }));
            },
          },
        ]
      : [];

  return (
    <section data-testid="patients-page" className="flex min-h-0 flex-1 flex-col">
      <PatientsToolbar
        table={table}
        view={search.view ?? PATIENTS_SEARCH_DEFAULTS.view}
        onViewChange={(view: PatientView) =>
          patchSearch({ view: view === PATIENTS_SEARCH_DEFAULTS.view ? undefined : view })
        }
        onNewPatient={can('create') ? openCreate : undefined}
      />
      <DataTable
        table={table}
        tableId={PATIENTS_TABLE_ID}
        label={t(PATIENTS_KEYS.manifest.title)}
        recordsLabel={t(PATIENTS_KEYS.table.records)}
        fold
        selectable
        minWidth={1450}
        onRowClick={(row) => openFile(row.original)}
        getRowTone={(row) => PATIENT_STATUS_TONES[row.original.status]}
        rowActions={(row) => rowActions(row.original)}
        bulkActions={bulkActions}
        hasNextPage={!loading && list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        fetchNextPage={list.fetchNextPage}
        empty={
          <TableEmpty
            loading={loading}
            filtered={filters.count > 0}
            onClearFilters={() => filters.apply({})}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
      <PatientDeleteConfirm patient={deleting} onClose={() => setDeleting(null)} />
      <Outlet />
    </section>
  );
}
