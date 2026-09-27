import type { ZodType } from 'zod';

import { apiClient } from '@/core/http/fetch-client.ts';
import { parseListTolerant } from '@/lib/parse-list-tolerant.ts';

/**
 * Server-side list query params — clinozy-be's `listSearchSortSchema` (search `q` +
 * `sort`/`order` + keyset cursor). Sent verbatim on the querystring; omit a key
 * to fall back to the server default (no filter, `created_at` ascending, first
 * page). Unlike {@link import('./fetch-all-pages.ts').fetchAllPages}, this fetches
 * ONE page so the client can window a large org-scoped list instead of loading
 * every row.
 */
export interface ListPageParams {
  /** Free-text search — server-side substring match (endpoint-defined columns). */
  q?: string;
  /** Sort field (endpoint-specific allowlist, e.g. `name` | `created_at`). */
  sort?: string;
  /** Sort direction; the server defaults to ascending. */
  order?: 'asc' | 'desc';
  /** Opaque keyset cursor from a prior page's `next`. */
  after?: string;
  /** Page size (server clamps to ≤ 100; defaults to 25 when omitted). */
  limit?: number;
}

/** One page of a cursor-paginated list plus the forward keyset cursor. */
export interface ListPage<T> {
  rows: T[];
  /** Next keyset cursor, or `null` when this is the last page. */
  next: string | null;
  /** Whether another page follows (`meta.pagination.has_more`). */
  hasMore: boolean;
}

/** Default page size — mirrors clinozy-be's cursor DTO default. */
const DEFAULT_LIMIT = 25;

/**
 * Fetch ONE page of a cursor-paginated clinozy-be list, forwarding server-side
 * `q`/`sort`/`order` and the keyset `after` cursor. Rows are parsed tolerantly
 * (a malformed row is dropped, not fatal); the forward cursor comes from
 * `meta.pagination.{next,has_more}`. Callers accumulate pages via
 * `useInfiniteQuery` — this never loads the whole list.
 *
 * @param path     List path (without `limit`/`after`); extra query params kept.
 * @param rowSchema Zod schema for ONE wire row.
 * @param resource  Telemetry label, e.g. `'memberships'`.
 * @param params    Server-side search/sort/cursor params.
 */
export async function fetchListPage<T>(
  path: string,
  rowSchema: ZodType<T>,
  resource: string,
  params: ListPageParams = {},
): Promise<ListPage<T>> {
  const query = new URLSearchParams();
  query.set('limit', String(params.limit ?? DEFAULT_LIMIT));
  if (params.q) query.set('q', params.q);
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);
  if (params.after) query.set('after', params.after);

  const sep = path.includes('?') ? '&' : '?';
  const res = await apiClient.get<unknown>(`${path}${sep}${query.toString()}`);
  const pagination = res.meta?.pagination;
  return {
    rows: parseListTolerant(rowSchema, res.data, resource),
    next: pagination?.next ?? null,
    hasMore: pagination?.has_more ?? false,
  };
}
