/**
 * The Appointments Filters' rules (KICKOFF §6.4 Filters): the values the URL
 * applies, how many are on, the URL patch that applies a choice, and the mini
 * calendar's days and load dots. Pure — the popover and its tests read them.
 */
import type {
  AppointmentStatusFilter,
  AppointmentView,
} from '@/shared/api/clinic/appointments-contracts.ts';
import type {
  CreatedFilter,
  FollowUpFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import { addCivilDays } from '@/shared/api/clinic/clinic-time.ts';

import type { AppointmentsSearch } from '../../appointments.search.ts';
import { shiftAnchor } from '../../hooks/useAppointmentsNavigation/index.ts';

/** The Filters' choices — pending in the popover, applied in the URL. */
export interface AppointmentFilterValues {
  doctor: string[];
  status: AppointmentStatusFilter;
  /** The Agenda's one day; the calendars' anchor. */
  date: string | undefined;
  created: CreatedFilter | undefined;
  followUp: FollowUpFilter | undefined;
}

/** Every filter off: every doctor, Active, from today on. */
export const CLEARED_FILTERS: AppointmentFilterValues = {
  doctor: [],
  status: 'active',
  date: undefined,
  created: undefined,
  followUp: undefined,
};

/** The values the URL applies now (`status` Active by default, Q-A5). */
export function appliedFilters(search: AppointmentsSearch): AppointmentFilterValues {
  return {
    doctor: search.doctor ?? [],
    status: search.status ?? 'active',
    date: search.date,
    created: search.created,
    followUp: search.followUp,
  };
}

/**
 * How many filters are on (H:5959–5961; `appointments.md:114`): one per
 * doctor, a status other than Active, the day — in the Agenda only, where it
 * is a filter; in the calendars it is the day shown — Created and Follow-up.
 */
export function countFilters(
  values: AppointmentFilterValues,
  view: AppointmentView,
): number {
  return (
    values.doctor.length +
    Number(values.status !== 'active') +
    Number(view === 'agenda' && values.date !== undefined) +
    Number(values.created !== undefined) +
    Number(values.followUp !== undefined)
  );
}

/** The URL patch that applies `values`; defaults leave the URL. */
export function filtersPatch(
  values: AppointmentFilterValues,
): Partial<AppointmentsSearch> {
  return {
    doctor: values.doctor.length > 0 ? values.doctor : undefined,
    status: values.status === 'active' ? undefined : values.status,
    date: values.date,
    created: values.created,
    followUp: values.followUp,
  };
}

/** The days of a month (`YYYY-MM-01`), in order (`YYYY-MM-DD`). */
export function monthDays(month: string): string[] {
  const next = shiftAnchor(month, 'month', 1);
  const days: string[] = [];
  for (let day = month; day < next; day = addCivilDays(day, 1)) days.push(day);
  return days;
}

/**
 * How many dots a day's load earns (H:5923): one up to 6 bookings, two for
 * 7–12, three above 12 — none for a free day.
 */
export function loadDots(booked: number): 0 | 1 | 2 | 3 {
  if (booked <= 0) return 0;
  if (booked <= 6) return 1;
  return booked <= 12 ? 2 : 3;
}
