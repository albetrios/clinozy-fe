import type { ZodType } from 'zod';

import { apiClient } from '@/core/http/fetch-client.ts';
import { parseListTolerant } from '@/lib/parse-list-tolerant.ts';

/**
 * Backend cursor-list contract (clinozy-be `cursorPaginationSchema`): request
 * `?limit=<=100&after=<opaque cursor>` and read the next cursor from
 * `meta.pagination.next` / `has_more`. The backend defaults to **25** rows when
 * no `limit` is sent — so a single un-paged fetch silently truncates large lists.
 * These endpoints expose no server-side sort/filter, so the UI keeps doing those
 * client-side; this helper just guarantees the client receives the FULL set.
 */
const PAGE_LIMIT = 100;

/** Safety cap so a buggy/looping `next` cursor can never fetch unbounded pages. */
const MAX_PAGES = 50;

/**
 * Fetch every page of a cursor-paginated list, following `meta.pagination.next`
 * until `has_more` is false. Rows are parsed tolerantly per page (a malformed
 * row is dropped, not fatal). Never throws on pagination shape.
 *
 * @param path     List path (without `limit`/`after`); extra query params are kept.
 * @param rowSchema Zod schema for ONE wire row.
 * @param resource  Telemetry label, e.g. `'memberships'`.
 */
export async function fetchAllPages<T>(
  path: string,
  rowSchema: ZodType<T>,
  resource: string,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const cursor = after ? `&after=${encodeURIComponent(after)}` : '';
    const res = await apiClient.get<unknown>(`${path}${sep}limit=${PAGE_LIMIT}${cursor}`);
    rows.push(...parseListTolerant(rowSchema, res.data, resource));

    const pagination = res.meta?.pagination;
    if (!(pagination?.has_more && pagination.next)) {
      return rows;
    }
    after = pagination.next;
  }

  console.warn(
    `[data] ${resource}: hit the ${MAX_PAGES}-page fetch cap (${rows.length} rows); list may be truncated`,
  );
  return rows;
}
