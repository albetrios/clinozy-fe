/**
 * URL search params of the Visit sheet (KICKOFF §4, §6.13): the open tab —
 * History by default, left out of the URL. The sheet's route only types its
 * search from here (`dialogSearch` in `routeTree.tsx`) and the sheet parses
 * it, so this module loads with the sheet, not the entry chunk; the tabs' type
 * is the access module's (`visit-access.ts`), checked here at compile time.
 */
import { oneOf } from '@/lib/routes/search-params.ts';
import type { VisitTab } from '@/shared/clinic/visit-access.ts';

/** The tabs a link can open on (the prototype's keys, H:4614). */
export const VISIT_TAB_VALUES = [
  'timeline',
  'consult',
  'treatment',
  'checkout',
] as const satisfies readonly VisitTab[];

/** Validated `?…` search params of `/visits/$visitId`. */
export interface VisitSearch {
  /** The open tab; absent = History. */
  tab?: (typeof VISIT_TAB_VALUES)[number];
}

/** Parse the sheet's params; an unknown tab is dropped (History). */
export function validateVisitSearch(search: Record<string, unknown>): VisitSearch {
  return { tab: oneOf(VISIT_TAB_VALUES, search.tab) };
}
