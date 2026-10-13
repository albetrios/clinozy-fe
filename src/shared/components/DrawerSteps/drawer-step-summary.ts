import { isolateJoin } from '@/lib/bidi-isolate.ts';

/** How many filled values a step head's sub line names (H:3840). */
const SUMMARY_LIMIT = 4;

/**
 * A step head's sub line (H:3840 `stepSum`): the step's first four filled
 * values, " · "-joined — else `empty` ("Not filled yet"). Each value is
 * isolated in its own direction, so a name, a phone or a date stays whole on a
 * right-to-left page.
 */
export function drawerStepSummary(
  parts: readonly (string | null | undefined)[],
  empty: string,
): string {
  return (
    isolateJoin(
      parts.filter((part): part is string => Boolean(part)).slice(0, SUMMARY_LIMIT),
    ) || empty
  );
}
