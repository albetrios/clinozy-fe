/**
 * The week in the contract's order, Monday first (`S:` `weekday`). Declared here, not imported:
 * `organization-api.ts` reads a member's working days on the first paint, where the generated
 * schema module (pages of zod) must not follow. `app-week.test.ts` pins it to the contract's enum.
 */
import type { Weekday } from './app-schema.ts';

/** The seven weekdays, Monday first. */
export const WEEK = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const satisfies readonly Weekday[];
