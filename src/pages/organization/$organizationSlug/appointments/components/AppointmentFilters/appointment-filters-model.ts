/**
 * The Appointments Filters' rules (KICKOFF §6.4 Filters): the values the URL
 * applies, how many are on and the URL patch that applies a choice. Pure — the
 * popover and its tests read them; the mini calendar's month and load dots are
 * the calendars' (`appointments.calendar.ts`).
 */
import type {
  AppointmentStatusFilter,
  AppointmentView,
} from '@/shared/api/clinic/appointments-contracts.ts';
import type {
  CreatedFilter,
  FollowUpFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';

import type { AppointmentsSearch } from '../../appointments.search.ts';

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
