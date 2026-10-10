/**
 * The search schemas of the Tasks room — New task's person on `create/`
 * (KICKOFF §6.10). Kept out of `tasks.search.ts` on purpose: `routeTree.tsx` (the
 * entry chunk) imports that module for the page's `validateSearch`, so a dialog's
 * schema there ships on every first paint. The dialog route only types its search
 * from here (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer
 * parses it, and this module loads with the room.
 */
import { PUBLIC_ID, textOf } from '@/lib/routes/search-params.ts';

/**
 * `/tasks/create`'s prefill: whom New task is for, when it was opened from them
 * (KICKOFF §6.10 New task; AMBER) — a lead (`?lead=lead_…`, the task points at it) or a
 * person (`?contact=con_…`). Public ids only.
 */
export interface TaskCreateSearch {
  lead?: string;
  contact?: string;
}

/** A clinozy-be public id with the given prefix (`lead_…`), else nothing. */
function publicIdOf(prefix: string, value: unknown): string | undefined {
  const text = textOf(value);
  return PUBLIC_ID.test(text) && text.startsWith(`${prefix}_`) ? text : undefined;
}

/** Parse `/tasks/create`'s prefill — a lead's or a contact's public id, else nothing. */
export function validateTaskCreateSearch(
  search: Record<string, unknown>,
): TaskCreateSearch {
  return {
    lead: publicIdOf('lead', search.lead),
    contact: publicIdOf('con', search.contact),
  };
}
