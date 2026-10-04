import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from '../../appointments.constants.ts';
import {
  ContactCell,
  DoctorCell,
  LatestCell,
  QuickViewCell,
  QuickViewHeader,
  ServiceCell,
  StatusCell,
  TimeCell,
} from './AgendaCells.tsx';

/** The desktop tracks (H:2032): 76 · 1.6fr · 1fr · .9fr · 1.1fr · 36 · 132, gap 10px. */
const DESKTOP_TRACKS = {
  time: '76px',
  contact: 'minmax(150px,1.6fr)',
  service: 'minmax(96px,1fr)',
  doctor: 'minmax(128px,.9fr)',
  latest: 'minmax(112px,1.1fr)',
  quickView: '36px',
  status: '132px',
} as const;

/** The tablet's six (H:145) — Latest update is hidden there — and nothing scrolls sideways. */
const TABLET_TRACKS = {
  time: '84px',
  contact: 'minmax(0,1.5fr)',
  service: 'minmax(0,1.1fr)',
  doctor: 'minmax(0,1fr)',
  latest: DESKTOP_TRACKS.latest,
  quickView: '40px',
  status: '160px',
} as const;

/**
 * Each cell's place on the phone's three tracks (H:120–128): the time across
 * rows 1–2, the contact and the status on row 1, the service and the doctor on
 * row 2, the latest update across row 3 — gone when there is none.
 */
const PHONE_AREAS = {
  time: '[grid-area:1/1/3/2] self-start',
  contact: '[grid-area:1/2/2/3]',
  service: '[grid-area:2/2/3/3]',
  doctor: '[grid-area:2/3/3/4] justify-self-end',
  latest: '[grid-area:3/2/4/4] has-[[data-latest-empty]]:hidden',
  status: '[grid-area:1/3/2/4] justify-self-end',
} as const;

/** The phone row's grid (H:121): 60px · the rest · auto, gap 6px 10px. */
export const AGENDA_PHONE_GRID =
  'grid-cols-[60px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5';

/**
 * The Agenda's columns (KICKOFF §6.4 Agenda; H:2032–2045): Time · Contact ·
 * Service · Appointed to · Latest update · Quick view · Status — Contact,
 * Service and Status sortable inside each day (asc → desc → off). A tablet
 * drops Latest update (H:144–147); a phone re-grids each row (H:120–128) and
 * leaves out the quick view. The cells read `AgendaCellsContext`.
 */
export function agendaColumns(
  t: TFunction,
  tier: ViewportTier,
): ColumnDef<DataTableFeatures, AppointmentRow>[] {
  const tracks = tier === 'tablet' ? TABLET_TRACKS : DESKTOP_TRACKS;
  const header = (key: string) => t(key, { ns: APPOINTMENTS_NS });
  const columns = APPOINTMENTS_KEYS.agenda.columns;
  return [
    {
      id: 'time',
      accessorFn: (row) => row.startTime,
      header: header(columns.time),
      enableSorting: false,
      cell: TimeCell,
      meta: { track: tracks.time, phoneClassName: PHONE_AREAS.time },
    },
    {
      id: 'contact',
      accessorFn: (row) => row.person.name,
      header: header(columns.contact),
      cell: ContactCell,
      meta: {
        track: tracks.contact,
        kind: 'person',
        primary: true,
        phoneClassName: PHONE_AREAS.contact,
      },
    },
    {
      id: 'service',
      accessorFn: (row) => row.serviceLabel,
      header: header(columns.service),
      cell: ServiceCell,
      meta: { track: tracks.service, phoneClassName: PHONE_AREAS.service },
    },
    {
      id: 'doctor',
      accessorFn: (row) => row.doctor?.firstName ?? '',
      header: header(columns.doctor),
      enableSorting: false,
      cell: DoctorCell,
      meta: { track: tracks.doctor, phoneClassName: PHONE_AREAS.doctor },
    },
    {
      id: 'latest',
      header: header(columns.latest),
      enableSorting: false,
      cell: LatestCell,
      meta: { track: tracks.latest, phoneClassName: PHONE_AREAS.latest },
    },
    {
      id: 'quickView',
      header: QuickViewHeader,
      enableSorting: false,
      cell: QuickViewCell,
      meta: {
        track: tracks.quickView,
        label: header(columns.quickView),
        phoneHidden: true,
      },
    },
    {
      id: 'status',
      accessorFn: (row) => row.status,
      header: header(columns.status),
      cell: StatusCell,
      meta: { track: tracks.status, phoneClassName: PHONE_AREAS.status },
    },
  ];
}
