/**
 * The reads the room's views make from the page's URL (KICKOFF §6.4;
 * api-integration §5.3): the Agenda's list params and the calendars' range
 * params, each within the header's branches. Kept out of
 * `appointments.search.ts` on purpose —
 * `routeTree.tsx` (the entry chunk) imports that module for `validateSearch`,
 * so anything else exported from it that the room uses ships on the first
 * paint; this module loads with the room.
 */
import type {
  AppointmentListParams,
  AppointmentRangeParams,
} from '@/shared/api/app/appointments-contracts.ts';

import {
  APPOINTMENTS_SEARCH_DEFAULTS,
  type AppointmentsSearch,
} from './appointments.search.ts';

/**
 * The Agenda read's params for the URL as it stands (defaults applied) and the
 * header picker's branches — what the Agenda hands `useAppointmentList`. The
 * API sorts by date and start.
 */
export function appointmentListParamsOf(
  search: AppointmentsSearch,
  branchIds: readonly string[],
): AppointmentListParams {
  return {
    date: search.date,
    status: search.status ?? APPOINTMENTS_SEARCH_DEFAULTS.status,
    doctorId: search.doctor,
    q: search.q,
    created: search.created,
    branchIds,
  };
}

/** What a calendar reads: the days it shows, the header's branches, and whose bookings. */
export interface AppointmentRangeRead {
  from: string;
  to: string;
  branchIds: readonly string[];
  /** The picked doctor's (default) — or every doctor's, when the view counts each itself. */
  doctors?: 'picked' | 'every';
}

/**
 * A calendar's read for the days it shows (`GET /app/appointments`, every
 * page of the range): the page's filters for that range — every doctor when
 * the view counts each doctor itself (the Day reads every doctor for its
 * picker and strip and keeps the picked one in its column).
 */
export function appointmentRangeParamsOf(
  search: AppointmentsSearch,
  { from, to, branchIds, doctors = 'picked' }: AppointmentRangeRead,
): AppointmentRangeParams {
  return {
    from,
    to,
    status: search.status ?? APPOINTMENTS_SEARCH_DEFAULTS.status,
    doctorId: doctors === 'every' ? undefined : search.doctor,
    q: search.q,
    created: search.created,
    branchIds,
  };
}
