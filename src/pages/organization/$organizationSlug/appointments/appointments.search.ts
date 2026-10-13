/**
 * URL search-param schemas for the Appointments room (consumed by routeTree's
 * `validateSearch`): the page's view, day, filters and search (KICKOFF §6.4,
 * D27, `S:26`), as clinozy-be's appointment list takes them (api-integration
 * §5.3). A value the URL can't hold — an unknown view, a bad date, a doctor
 * that isn't a membership id — is dropped, never an error. Defaults stay out
 * of the URL (`/appointments` is the Agenda, Active). The API sorts by date and
 * start and has no follow-up filter on bookings, so neither is a param (G3).
 *
 * The page and its dialog routes share one search string: `create/` reads the
 * page's `date` and `doctor` as its prefill (`?date=&time=&doctor=`), so a slot
 * click keeps the Day behind the drawer on the same day. The dialog routes' own
 * params are `appointments.dialog-search.ts`'s, off the entry chunk.
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod. The test pins
 * each list to the contract's enum. For the same reason the page's render
 * rules (Week → Day on a phone) live in the island's hooks, off the first paint.
 */
import { matchOf, oneOf, PUBLIC_ID, queryOf } from '@/lib/routes/search-params.ts';
import {
  CALENDAR_DATE,
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/app/app-list-filters.ts';
import type {
  AppointmentStatusFilter,
  AppointmentView,
} from '@/shared/api/app/appointments-contracts.ts';

const VIEWS = [
  'agenda',
  'day',
  'week',
  'month',
] as const satisfies readonly AppointmentView[];
const STATUS_FILTERS = [
  'active',
  'all',
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
] as const satisfies readonly AppointmentStatusFilter[];

/** Validated `?…` search params for `/appointments` and its dialog routes. */
export interface AppointmentsSearch {
  /** Agenda (default) · Day · Week · Month (D27). */
  view?: AppointmentView;
  /**
   * A calendar day, clinic-local: in Agenda the one day picked in Filters
   * (else "from today on"); in Day, Week and Month the day the board shows.
   */
  date?: string;
  /** "APPOINTED TO": one doctor (`mem_…`) — the API takes one (G3). */
  doctor?: string;
  /** One status, All, or Active — the default (Scheduled, Confirmed, Checked in; Q-A5). */
  status?: AppointmentStatusFilter;
  /** Name, mobile or "#ID" (≤ 80 characters, the contract's `q`). */
  q?: string;
  created?: CreatedFilter;
}

/** The page's state when the URL says nothing. */
export const APPOINTMENTS_SEARCH_DEFAULTS = {
  view: 'agenda',
  status: 'active',
} as const satisfies AppointmentsSearch;

/**
 * Parse `/appointments` search params. Every key is answered, `undefined`
 * included: the router keeps a raw value the schema omits, so dropping one
 * means saying so.
 */
export function validateAppointmentsSearch(
  search: Record<string, unknown>,
): AppointmentsSearch {
  return {
    view: oneOf(VIEWS, search.view),
    date: matchOf(CALENDAR_DATE, search.date),
    doctor: matchOf(
      PUBLIC_ID,
      Array.isArray(search.doctor) ? search.doctor[0] : search.doctor,
    ),
    status: oneOf(STATUS_FILTERS, search.status),
    q: queryOf(search.q, 80),
    created: readCreatedFilter(search.created),
  };
}
