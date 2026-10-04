import type { SortOrder } from './medical-contracts.ts';

/**
 * A tab's column sort from the URL's `key:direction` — only the tab's own
 * sortable keys (the URL reader accepts every tab's), else no sort.
 */
export function sortParamsOf<K extends string>(
  sort: string | undefined,
  keys: readonly K[],
): { sort?: K; order?: SortOrder } {
  const [name, direction] = sort?.split(':') ?? [];
  const key = keys.find((candidate) => candidate === name);
  if (!key) return {};
  return { sort: key, order: direction === 'desc' ? 'desc' : 'asc' };
}
