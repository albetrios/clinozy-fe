/**
 * URL search-param schema for Today (consumed by routeTree's `validateSearch`,
 * KICKOFF §6.2): the lane the member picked and the work queue's scope. The
 * branches are the header picker's server preference (D32, §3.2), not a param.
 * A value the URL can't hold is dropped, never an error; defaults stay out of
 * the URL (`/today` is the default lane, Mine).
 *
 * The values are declared here, not imported: `routeTree.tsx` is the entry
 * chunk, and the floor's contract module is zod. The test pins each list to
 * the contract's.
 */
import { oneOf } from '@/lib/routes/search-params.ts';

/** The floor's lanes, in their fixed order — the contract's `TODAY_LANES`. */
export const TODAY_LANE_VALUES = [
  'enquiries',
  'arriving',
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
] as const;

/** The work queue's scopes: "Mine" (default) · "Everyone". */
export const TODAY_QUEUE_VALUES = ['mine', 'everyone'] as const;

/** Validated `?…` search params for `/today`. */
export interface TodaySearch {
  /** The lane in the panel; absent = the default-lane rule. Lasts the session, never stored. */
  lane?: (typeof TODAY_LANE_VALUES)[number];
  /** The work queue's scope; absent = Mine. */
  queue?: (typeof TODAY_QUEUE_VALUES)[number];
}

/**
 * Parse `/today` search params. Every key is answered, `undefined` included:
 * the router keeps a raw value the schema omits, so dropping one means saying so.
 */
export function validateTodaySearch(search: Record<string, unknown>): TodaySearch {
  return {
    lane: oneOf(TODAY_LANE_VALUES, search.lane),
    queue: oneOf(TODAY_QUEUE_VALUES, search.queue),
  };
}
