/**
 * Readers for URL search params — the pieces every room's `<page>.search.ts`
 * builds its `validateSearch` from. Dependency-free on purpose: the route tree
 * is the entry chunk, so a room's search parser costs its value lists, not a
 * schema library. A value the URL can't hold is dropped (`undefined`), never an
 * error.
 */

/** Sort direction in the URL form `key:asc` / `key:desc` (the shared table's form). */
export type SortDirection = 'asc' | 'desc';

/** A record id in the URL — a UUID, either case (`?owner=`, `?doctor=`, `?who=`). */
export const RECORD_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** A raw param as trimmed text — the router reads `?q=2363` as a number. */
export function textOf(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

/** `value` when it is one of `values`, else `undefined`. */
export function oneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): T | undefined {
  return (values as readonly unknown[]).includes(value) ? (value as T) : undefined;
}

/**
 * A multi-value param — a JSON array or a comma list (`?source=instagram,google`)
 * — keeping the entries `accept` allows, once each; none left is no filter.
 */
export function listOf<T extends string>(
  value: unknown,
  accept: (entry: string) => boolean,
): T[] | undefined {
  const entries = Array.isArray(value) ? value : textOf(value).split(',');
  const kept = entries.map(textOf).filter((entry) => entry && accept(entry));
  return kept.length > 0 ? ([...new Set(kept)] as T[]) : undefined;
}

/**
 * A single param in a fixed shape — a calendar day, a clock time, an id —
 * trimmed; one that doesn't match `pattern` whole is none.
 */
export function matchOf(pattern: RegExp, value: unknown): string | undefined {
  const text = textOf(value);
  return text && pattern.test(text) ? text : undefined;
}

/** A free-text param, trimmed and cut to `max` characters; empty is none. */
export function queryOf(value: unknown, max: number): string | undefined {
  return textOf(value).slice(0, max) || undefined;
}

/** A column sort `key:asc` / `key:desc` whose key is one of `keys`; anything else is none. */
export function sortOf<K extends string>(
  keys: readonly K[],
  value: unknown,
): `${K}:${SortDirection}` | undefined {
  const sort = textOf(value);
  const [key, direction] = sort.split(':');
  return oneOf(keys, key) && (direction === 'asc' || direction === 'desc')
    ? (sort as `${K}:${SortDirection}`)
    : undefined;
}
