/**
 * The reads the room's views make from the page's URL (KICKOFF §6.4): the
 * Agenda's list params and the calendars' range params. Kept out of
 * `appointments.search.ts` on purpose —
 * `routeTree.tsx` (the entry chunk) imports that module for `validateSearch`,
 * so anything else exported from it that the room uses ships on the first
 * paint; this module loads with the room.
 */
import type {
  AppointmentListParamsInput,
  AppointmentRangeParamsInput,
  AppointmentSortKey,
} from '@/shared/api/clinic/appointments-contracts.ts';

import {
  APPOINTMENTS_SEARCH_DEFAULTS,
  type AppointmentsSearch,
} from './appointments.search.ts';

/**
 * The Agenda read's params for the URL as it stands (defaults applied) — what
 * the Agenda hands `useAppointmentList` and `useAppointmentDaySummaries`.
 */
export function appointmentListParamsOf(
  search: AppointmentsSearch,
): AppointmentListParamsInput {
  const [sort, order] = (search.sort?.split(':') ?? []) as [
    AppointmentSortKey?,
    ('asc' | 'desc')?,
  ];
  return {
    date: search.date,
    status: search.status ?? APPOINTMENTS_SEARCH_DEFAULTS.status,
    doctorIds: search.doctor ?? [],
    q: search.q,
    created: search.created,
    followUp: search.followUp,
    sort,
    order,
  };
}

/**
 * A calendar's read for the days it shows (`listAppointmentsRange`): the
 * page's filters for that range — every doctor when the view counts each
 * doctor itself (the Day reads every doctor for its picker and strip and keeps
 * the picked ones in its column).
 */
export function appointmentRangeParamsOf(
  search: AppointmentsSearch,
  range: { from: string; to: string },
  doctors: 'picked' | 'every' = 'picked',
): AppointmentRangeParamsInput {
  return {
    from: range.from,
    to: range.to,
    status: search.status ?? APPOINTMENTS_SEARCH_DEFAULTS.status,
    doctorIds: doctors === 'every' ? [] : (search.doctor ?? []),
    q: search.q,
    created: search.created,
    followUp: search.followUp,
  };
}
