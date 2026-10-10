import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import {
  organizationAppointment,
  organizationAppointmentCreate,
} from '@/lib/routes/appointments-builders.ts';
import {
  type AppointmentCalendarView,
  appointmentViewRange,
} from '@/shared/api/clinic/appointment-views.ts';
import type { AppointmentView } from '@/shared/api/clinic/appointments-contracts.ts';
import {
  addCivilDays,
  addCivilMonths,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';

import {
  type AppointmentsSearch,
  validateAppointmentsSearch,
} from '../../appointments.search.ts';

/** A booking prefill a "New appointment" can carry (`S:27`). */
export interface AppointmentCreatePrefill {
  /** The day the board shows behind the drawer — and the booking's day. */
  date?: string;
  /** An empty Day slot's start, `HH:mm`. */
  time?: string;
  /** Rebook / Copy: a new appointment from this one (Q-A6). */
  copyOf?: string;
  /** Who: the contact (`con_…`, the contact card's "+ Appointment"). */
  who?: string;
}

/** The Appointments page's URL and the moves the room makes through it. */
export interface AppointmentsNavigation {
  /** The page's params as they stand (defaults not filled in). */
  search: AppointmentsSearch;
  /** The calendars' day: the URL's `date`, else today (clinic-local). */
  anchor: string;
  /** Patch the page's params in place (no history entry, the hash kept); `undefined` drops a key. */
  patch: (next: Partial<AppointmentsSearch>) => void;
  /** Switch the view; the Agenda drops the calendars' day ("from today on", H:5941). */
  setView: (view: AppointmentView) => void;
  /** The calendars' day, in place. */
  setAnchor: (date: string) => void;
  /** Day / Week / Month: one period back or on. */
  shiftPeriod: (view: Exclude<AppointmentView, 'agenda'>, direction: -1 | 1) => void;
  /** "Today" · "This week" · "This month". */
  goToday: () => void;
  /** A Week day header, a Month cell, "Open day": that day in Day. */
  openDay: (date: string) => void;
  /** The New appointment drawer over the page, the page's params kept (`create/`). */
  openCreate: (prefill?: AppointmentCreatePrefill) => void;
  /** The booking's drawer — Edit, or Reschedule (`?mode=reschedule`). */
  openAppointment: (id: string, mode?: 'reschedule') => void;
}

/**
 * The calendars' anchor one period away (`shiftPeriod`); a month keeps its day
 * inside the month (31 Jan + 1 month → 28 Feb).
 */
export function shiftAnchor(
  anchor: string,
  view: Exclude<AppointmentView, 'agenda'>,
  direction: -1 | 1,
): string {
  if (view === 'month') return addCivilMonths(anchor, direction);
  return addCivilDays(anchor, view === 'week' ? 7 * direction : direction);
}

/** Whether the period shown holds today (the "Today" button's pressed look). */
export function isCurrentPeriod(
  view: AppointmentCalendarView,
  anchor: string,
  today: string,
): boolean {
  const { from, to } = appointmentViewRange(view, anchor);
  return today >= from && today <= to;
}

/**
 * The Appointments URL (D27): the page's own params, patched in place — the
 * Settings hash kept — and the dialog routes opened over the page with the
 * page's params kept, so the board behind a drawer stays where it was.
 */
export function useAppointmentsNavigation(): AppointmentsNavigation {
  const { organizationSlug = '' } = useParams({ strict: false });
  const raw: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const search = useMemo(() => validateAppointmentsSearch(raw), [raw]);
  const anchor = search.date ?? clinicToday();

  const patch = useCallback(
    (next: Partial<AppointmentsSearch>) => {
      void navigate({
        to: '.',
        search: (current: Record<string, unknown>) => ({ ...current, ...next }),
        hash: true,
        replace: true,
      });
    },
    [navigate],
  );

  const pageSearch = useCallback(
    (current: Record<string, unknown>) => validateAppointmentsSearch(current),
    [],
  );

  return {
    search,
    anchor,
    patch,
    // The Agenda's day is a filter, the calendars' their anchor: a calendar
    // keeps the day in view; the Agenda starts from today again.
    setView: (view) =>
      patch(view === 'agenda' ? { view: undefined, date: undefined } : { view }),
    setAnchor: (date) => patch({ date }),
    shiftPeriod: (view, direction) =>
      patch({ date: shiftAnchor(anchor, view, direction) }),
    goToday: () => patch({ date: undefined }),
    openDay: (date) => patch({ view: 'day', date }),
    openCreate: (prefill = {}) => {
      void navigate({
        ...organizationAppointmentCreate(organizationSlug),
        search: (current: Record<string, unknown>) => ({
          ...pageSearch(current),
          ...(prefill.date ? { date: prefill.date } : {}),
          ...(prefill.time ? { time: prefill.time } : {}),
          ...(prefill.copyOf ? { copyOf: prefill.copyOf } : {}),
          ...(prefill.who ? { who: prefill.who } : {}),
        }),
        hash: true,
      });
    },
    openAppointment: (id, mode) => {
      void navigate({
        ...organizationAppointment(organizationSlug, id),
        search: (current: Record<string, unknown>) => ({
          ...pageSearch(current),
          ...(mode ? { mode } : {}),
        }),
        hash: true,
      });
    },
  };
}
