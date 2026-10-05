/**
 * URL search-param schemas for the Appointments room (consumed by routeTree's
 * `validateSearch`): the page's view, day, filters, search and sort (KICKOFF
 * §6.4, D27, `S:26`). A value the URL can't hold — an unknown view, a bad
 * date, a doctor that isn't an id — is dropped, never an error. Defaults stay
 * out of the URL (`/appointments` is the Agenda, Active).
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
import {
  listOf,
  matchOf,
  oneOf,
  queryOf,
  RECORD_ID,
  sortOf,
} from '@/lib/routes/search-params.ts';
import type {
  AppointmentSortKey,
  AppointmentStatusFilter,
  AppointmentView,
} from '@/shared/api/clinic/appointments-contracts.ts';
import {
  CALENDAR_DATE,
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';

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
const SORT_KEYS = [
  'contact',
  'service',
  'status',
] as const satisfies readonly AppointmentSortKey[];

/** A column sort in the URL: `contact:asc`, `status:desc` (the shared table's form). */
export type AppointmentsSort = `${AppointmentSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for `/appointments` and its dialog routes. */
export interface AppointmentsSearch {
  /** Agenda (default) · Day · Week · Month (D27). */
  view?: AppointmentView;
  /**
   * A calendar day, clinic-local: in Agenda the one day picked in Filters
   * (else "from today on"); in Day, Week and Month the day the board shows.
   */
  date?: string;
  /** "APPOINTED TO": any of these doctors. */
  doctor?: string[];
  /** One status, All, or Active — the default (Scheduled, Confirmed, Checked in; Q-A5). */
  status?: AppointmentStatusFilter;
  /** Name, mobile or "#ID" (≤ 80 characters, the contract's `q`). */
  q?: string;
  created?: CreatedFilter;
  followUp?: FollowUpFilter;
  /** Agenda only: a column sorted inside each day. */
  sort?: AppointmentsSort;
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
    doctor: listOf(search.doctor, (entry) => RECORD_ID.test(entry)),
    status: oneOf(STATUS_FILTERS, search.status),
    q: queryOf(search.q, 80),
    created: readCreatedFilter(search.created),
    followUp: readFollowUpFilter(search.followUp),
    sort: sortOf(SORT_KEYS, search.sort),
  };
}
