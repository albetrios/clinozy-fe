'use no memo';
// `useTable` hands back live objects whose getters React Compiler memoisation
// would serve stale (see DataTable).

import { useNavigate, useParams } from '@tanstack/react-router';
import { type SortingState, type Updater, useTable } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationLeadCreate } from '@/lib/routes/leads-builders.ts';
import { groupAppointmentsByDay } from '@/shared/api/clinic/appointment-views.ts';
import type {
  AppointmentPerson,
  AppointmentRow,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { APPOINTMENT_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTable, dataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import {
  useAppointmentDaySummaries,
  useAppointmentList,
  useAppointmentSlotLabel,
} from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import {
  sortingFromSearch,
  sortingToSearch,
} from '@/shared/hooks/useDataTableUrlState/useDataTableUrlState.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { appointmentListParamsOf } from '../../appointments.params.ts';
import type { AppointmentsSort } from '../../appointments.search.ts';
import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';
import { useAppointmentActions } from '../AppointmentActions/index.ts';
import {
  AgendaCellsContext,
  type AgendaCellsValue,
  type AgendaStatusTarget,
} from './agenda-cells-context.ts';
import { AGENDA_PHONE_GRID, agendaColumns } from './agenda-columns.ts';
import { AgendaDayHeader } from './AgendaDayHeader.tsx';

/** The table id: test ids (`appointments-table…`) and the room's device prefs. */
const TABLE_ID = 'appointments';

/** The Agenda's minimum row width with every column (H:2032): it scrolls sideways inside the card below it. */
const AGENDA_MIN_WIDTH = 790;

/**
 * The Agenda's 10px column gap and 37px header (H:2032) — set on the shared
 * table through its variables, so the header and rows share them.
 */
const AGENDA_METRICS = '[--dt-gap:0.625rem] [--dt-head-h:2.3125rem]';

/** "No appointments here · book one" — "book one" only for a member who can book (H:2050). */
function AgendaEmpty({ onBook }: { onBook?: () => void }) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  return (
    <p
      data-testid={APPOINTMENTS_TEST_IDS.empty}
      className="text-body text-muted-foreground p-10 text-center"
    >
      {t(APPOINTMENTS_KEYS.agenda.empty)}
      {onBook ? (
        <button
          type="button"
          data-testid={APPOINTMENTS_TEST_IDS.bookOne}
          onClick={onBook}
          className="text-foreground underline underline-offset-2"
        >
          {t(APPOINTMENTS_KEYS.agenda.bookOne)}
        </button>
      ) : null}
    </p>
  );
}

/**
 * The Agenda (KICKOFF §6.4; H:2031–2052, `appointments.md:26–40`): the shared
 * table grouped by day under sticky headers — from today on, or the one day
 * picked in Filters — in cursor pages of 50 with infinite scroll and "All
 * appointments loaded" (D7). Contact, Service and Status sort inside each day
 * through the URL; a row opens the booking's drawer. While a search, sort or
 * filter loads, the rows stay as bars (`refreshing`). A tablet drops Latest
 * update; a phone re-grids each row (`regrid`).
 */
export function AppointmentsAgenda() {
  const { t } = useTranslation([APPOINTMENTS_NS]);
  const tier = useViewportTier();
  const navigation = useAppointmentsNavigation();
  const actions = useAppointmentActions();
  const access = useClinicAccess();
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const slotLabel = useAppointmentSlotLabel();
  const { preferences } = usePreferences();
  const [statusTarget, setStatusTarget] = useState<AgendaStatusTarget | null>(null);

  const params = {
    ...appointmentListParamsOf(navigation.search),
    branchIds: preferences.branchFilter,
  };
  const list = useAppointmentList(params, { notifyOnError: false });
  const summaries = useAppointmentDaySummaries(params, { notifyOnError: false });
  useListLoadError(list, TABLE_ID);
  // Each day header counts the whole day (Appendix F) — the loaded rows' own
  // counts until the per-day summary is in.
  const summaryOf = new Map(
    groupAppointmentsByDay(list.rows, summaries.data).map((group) => [
      group.date,
      group.summary,
    ]),
  );
  const today = clinicToday();

  const sorting = sortingFromSearch(navigation.search.sort);
  const setSorting = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    navigation.patch({ sort: sortingToSearch(next) as AppointmentsSort | undefined });
  };

  const newAppointment = (person: AppointmentPerson) => {
    const who = person.patientId ?? person.leadId;
    navigation.openCreate(who ? { who } : {});
  };
  const newLead = (person: AppointmentPerson) => {
    void navigate({
      ...organizationLeadCreate(organizationSlug),
      search: { name: person.name, phone: person.phone ?? undefined },
    });
  };

  // One set of columns per language and tier: the cells read the live state
  // from `AgendaCellsContext`, so state changes never remount them.
  const columns = useMemo(() => agendaColumns(t, tier), [t, tier]);
  const cells: AgendaCellsValue = {
    timeOf: (row) => slotLabel(row.date, row.startTime).time,
    canEdit: actions.canEdit,
    statusTarget,
    setStatusTarget,
    onNewAppointment: actions.canCreate ? newAppointment : undefined,
    onNewLead: access.can('leads', 'create') ? newLead : undefined,
  };

  const table = useTable({
    features: dataTableFeatures,
    data: list.rows,
    columns,
    getRowId: (row: AppointmentRow) => row.id,
    manualSorting: true,
    manualPagination: true,
    state: {
      sorting,
      columnVisibility: { latest: tier !== 'tablet' },
    },
    onSortingChange: setSorting,
  });

  return (
    <AgendaCellsContext.Provider value={cells}>
      <DataTable
        table={table}
        tableId={TABLE_ID}
        recordsLabel={t(APPOINTMENTS_KEYS.records)}
        minWidth={tier === 'desktop' ? AGENDA_MIN_WIDTH : undefined}
        phoneLayout="regrid"
        phoneGridClassName={AGENDA_PHONE_GRID}
        getRowTone={(row) => APPOINTMENT_STATUS_TONES[row.original.status]}
        // The Agenda's edge is the status dot colour (`appointments.md`, H:5913).
        rowEdge="dot"
        onRowClick={(row) => actions.open(row.original)}
        groups={{
          keyOf: (row) => row.date,
          header: ({ key, index }) => (
            <AgendaDayHeader
              date={key}
              today={today}
              groupIndex={index}
              summary={summaryOf.get(key)}
            />
          ),
        }}
        refreshing={list.isRefreshing}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        fetchNextPage={list.fetchNextPage}
        empty={
          list.isPending ? (
            <SkeletonRows
              rows={8}
              avatar
              label={t(APPOINTMENTS_KEYS.manifest.title)}
              rowClassName="h-13 px-(--table-pad-x)"
            />
          ) : (
            <AgendaEmpty
              onBook={actions.canCreate ? () => navigation.openCreate() : undefined}
            />
          )
        }
        className={`flex-1 ${AGENDA_METRICS}`}
      />
    </AgendaCellsContext.Provider>
  );
}
