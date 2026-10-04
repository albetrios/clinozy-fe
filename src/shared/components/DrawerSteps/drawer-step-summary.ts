/** How many filled values a step head's sub line names (H:3840). */
const SUMMARY_LIMIT = 4;

/**
 * A step head's sub line (H:3840 `stepSum`): the step's first four filled
 * values, " · "-joined — else `empty` ("Not filled yet").
 */
export function drawerStepSummary(
  parts: readonly (string | null | undefined)[],
  empty: string,
): string {
  return (
    parts
      .filter((part): part is string => Boolean(part))
      .slice(0, SUMMARY_LIMIT)
      .join(' · ') || empty
  );
}
