/**
 * The search schemas of the Tasks room — New task's lead or patient on `create/`
 * (KICKOFF §6.10). Kept out of `tasks.search.ts` on purpose: `routeTree.tsx` (the
 * entry chunk) imports that module for the page's `validateSearch`, so a dialog's
 * schema there ships on every first paint. The dialog route only types its search
 * from here (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer
 * parses it, and this module loads with the room.
 */
import { matchOf, RECORD_ID } from '@/lib/routes/search-params.ts';

/**
 * `/tasks/create`'s prefill: the lead or patient New task is for, when it was
 * opened from one (`?lead=` / `?patient=`, KICKOFF §6.10 New task; AMBER).
 */
export interface TaskCreateSearch {
  lead?: string;
  patient?: string;
}

/** Parse `/tasks/create`'s prefill — a record id, else nothing. */
export function validateTaskCreateSearch(
  search: Record<string, unknown>,
): TaskCreateSearch {
  return {
    lead: matchOf(RECORD_ID, search.lead),
    patient: matchOf(RECORD_ID, search.patient),
  };
}
