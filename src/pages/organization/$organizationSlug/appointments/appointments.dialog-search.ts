/**
 * The search schemas of the Appointments room — the booking prefill on `create/`
 * (`S:27`) and the drawer's mode on `$appointmentId/` (`S:28`). Kept out of
 * `appointments.search.ts` on purpose: `routeTree.tsx` (the entry chunk) imports
 * that module for the page's `validateSearch`, so a dialog's schema there ships on
 * every first paint. The dialog route only types its search from here
 * (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer parses it,
 * and this module loads with the room.
 */
import { matchOf, oneOf, RECORD_ID, textOf } from '@/lib/routes/search-params.ts';

const SOURCES = ['chat', 'task'] as const;
const MODES = ['reschedule'] as const;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The booking prefill on `/appointments/create` (`S:27`; the date and doctor
 * are the page's `date` and `doctor`).
 */
export interface AppointmentCreateSearch {
  /** The start, `HH:mm` — an empty Day slot's time, rounded to 15 minutes. */
  time?: string;
  /** Who: a patient's or a lead's id. */
  who?: string;
  /** The booking a Copy or Rebook starts from — a new appointment, the old one stays. */
  copyOf?: string;
  /** Opened from a chat or a task: step 1 collapsed, Date & time open (plan-only). */
  source?: 'chat' | 'task';
  /**
   * The room it was opened from, kept behind the drawer (KICKOFF §4, A-P1) —
   * as given: read it only through `safeReferrer`, whose allow-list
   * (`clinic-referrer.ts`) decides, so anything off the list is the page.
   */
  from?: string;
}

/** Parse the `/appointments/create` prefill. */
export function validateAppointmentCreateSearch(
  search: Record<string, unknown>,
): AppointmentCreateSearch {
  return {
    time: matchOf(CLOCK_TIME, search.time),
    who: matchOf(RECORD_ID, search.who),
    copyOf: matchOf(RECORD_ID, search.copyOf),
    source: oneOf(SOURCES, search.source),
    from: textOf(search.from) || undefined,
  };
}

/** The drawer's params on `/appointments/$appointmentId` (`S:28`). */
export interface AppointmentSearch {
  /** "Move to another time" / "Reschedule": the form opens as "Reschedule #<seq>" (plan-only). */
  mode?: 'reschedule';
  /** The room it was opened from (KICKOFF §4, A-P1) — as given; see {@link AppointmentCreateSearch.from}. */
  from?: string;
}

/** Parse the `/appointments/$appointmentId` params. */
export function validateAppointmentSearch(
  search: Record<string, unknown>,
): AppointmentSearch {
  return {
    mode: oneOf(MODES, search.mode),
    from: textOf(search.from) || undefined,
  };
}
