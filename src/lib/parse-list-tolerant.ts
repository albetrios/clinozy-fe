import type { ZodType } from 'zod';

/**
 * Parse an array of API records, tolerating malformed rows: valid rows are kept;
 * invalid rows are dropped and `console.warn`-ed so a single bad record never
 * blanks the whole list view. Warn-level logs are captured by Sentry's console
 * integration, so drops surface in telemetry without coupling `lib` to Sentry.
 *
 * @param schema   Zod schema for ONE row (the wire shape).
 * @param data     Raw response payload (expected to be an array).
 * @param resource Telemetry label, e.g. `'memberships'`.
 * @returns The valid rows; never throws on a bad row or a non-array.
 */
export function parseListTolerant<T>(
  schema: ZodType<T>,
  data: unknown,
  resource: string,
): T[] {
  if (!Array.isArray(data)) {
    console.warn(`[data] ${resource}: expected an array response, got ${typeof data}`);
    return [];
  }
  const kept: T[] = [];
  let dropped = 0;
  for (const item of data) {
    const result = schema.safeParse(item);
    if (result.success) {
      kept.push(result.data);
    } else {
      dropped += 1;
    }
  }
  if (dropped > 0) {
    console.warn(
      `[data] ${resource}: dropped ${dropped} malformed row(s) of ${data.length}`,
    );
  }
  return kept;
}
