'use no memo';
// `useTable` hands back live objects whose getters React Compiler memoisation
// would serve stale (see DataTable).

import { useNavigate, useParams } from '@tanstack/react-router';
import { useTable } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationLeadCreate } from '@/lib/routes/leads-builders.ts';
import {
  agendaCountsWindow,
  groupAppointmentsByDay,
} from '@/shared/api/clinic/appointment-views.ts';
import type {
  AppointmentDayCount,
  AppointmentPerson,
  AppointmentRow,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { APPOINTMENT_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DataTable,
  dataTableFeatures,
  type DataTableGroup,
} from '@/shared/components/DataTable/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import {
  useAppointmentDayCounts,
  useAppointmentList,
  useAppointmentSlotLabel,
} from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { appointmentListParamsOf } from '../../appointments.params.ts';
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
    <EmptyState
      variant="inline"
      title={t(APPOINTMENTS_KEYS.agenda.empty)}
      testId={APPOINTMENTS_TEST_IDS.empty}
      className="text-body p-10 text-center"
      action={
        onBook ? (
          <button
            type="button"
            data-testid={APPOINTMENTS_TEST_IDS.bookOne}
            onClick={onBook}
            className="text-foreground underline underline-offset-2"
          >
            {t(APPOINTMENTS_KEYS.agenda.bookOne)}
          </button>
        ) : undefined
      }
    />
  );
}

/**
 * A day's sticky header — the table calls it for each run of one day's rows,
 * with the day's counts from `countsOf`.
 */
function agendaDayHeader(
  { key, index }: DataTableGroup<AppointmentRow>,
  today: string,
  countsOf: ReadonlyMap<string, AppointmentDayCount | undefined>,
) {
  return (
    <AgendaDayHeader
      date={key}
      today={today}
      groupIndex={index}
      counts={countsOf.get(key)}
    />
  );
}

/**
 * The Agenda (KICKOFF §6.4; H:2031–2052, `appointments.md:26–40`): the shared
 * table grouped by day under sticky headers — from today on, or the one day
 * picked in Filters — by date and start (the API's order, no column sort) in
 * cursor pages of 50 with infinite scroll and "All appointments loaded" (D7),
 * within the header's branches; each day header counts the day from
 * `daily-counts` over the days loaded. A row opens the booking's drawer. While
 * a search or filter loads, the rows stay as bars (`refreshing`). A tablet
 * drops Latest update; a phone re-grids each row (`regrid`).
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
  const team = useTeamDirectory();
  const [statusTarget, setStatusTarget] = useState<AgendaStatusTarget | null>(null);

  const params = appointmentListParamsOf(navigation.search, preferences.branchFilter);
  const list = useAppointmentList(params, { notifyOnError: false });
  useListLoadError(list, TABLE_ID);
  // Each day header counts the whole day from the server, over the days loaded
  // (or the one day picked) — within the branches and the doctor; the status,
  // search and created filters do not narrow them (the API's rule).
  const countsWindow = agendaCountsWindow(list.rows, params.date);
  const counts = useAppointmentDayCounts(
    countsWindow && {
      ...countsWindow,
      doctorId: params.doctorId,
      branchIds: params.branchIds,
    },
    { notifyOnError: false },
  );
  const countsOf = new Map(
    groupAppointmentsByDay(list.rows, counts.data).map((group) => [
      group.date,
      group.counts,
    ]),
  );
  const today = clinicToday();

  const { openCreate } = navigation;
  const { canEdit, canCreate } = actions;
  const canCreateLead = access.can('leads', 'create');

  // One set of columns per language and tier: the cells read the live state
  // from `AgendaCellsContext`, so state changes never remount them.
  const columns = useMemo(() => agendaColumns(t, tier), [t, tier]);
  const cells = useMemo<AgendaCellsValue>(() => {
    const newAppointment = (person: AppointmentPerson) => {
      openCreate({ who: person.contactId });
    };
    const newLead = (person: AppointmentPerson) => {
      void navigate({
        ...organizationLeadCreate(organizationSlug),
        search: { name: person.name, phone: person.phone ?? undefined },
      });
    };
    return {
      timeOf: (row) => slotLabel(row.date, row.startTime).time,
      canEdit,
      teamUpdatedAt: team.updatedAt,
      statusTarget,
      setStatusTarget,
      onNewAppointment: canCreate ? newAppointment : undefined,
      onNewLead: canCreateLead ? newLead : undefined,
    };
  }, [
    slotLabel,
    canEdit,
    team.updatedAt,
    canCreate,
    canCreateLead,
    statusTarget,
    openCreate,
    navigate,
    organizationSlug,
  ]);

  const table = useTable({
    features: dataTableFeatures,
    data: list.rows,
    columns,
    getRowId: (row: AppointmentRow) => row.id,
    manualSorting: true,
    manualPagination: true,
    state: { columnVisibility: { latest: tier !== 'tablet' } },
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
          header: (group) => agendaDayHeader(group, today, countsOf),
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
            <AgendaEmpty onBook={canCreate ? () => openCreate() : undefined} />
          )
        }
        className={`flex-1 ${AGENDA_METRICS}`}
      />
    </AgendaCellsContext.Provider>
  );
}
