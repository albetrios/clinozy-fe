import type { ResponseMeta } from '@/core/http/fetch-client.ts';

/** Camel-cased, UI-friendly page descriptor derived from `meta.pagination`. */
interface PageInfo {
  perPage: number;
  /** Opaque cursor for the next page, or `null` when there are no more. */
  next: string | null;
  hasMore: boolean;
  /** Present only when the backend computed a total (omitted on some lists). */
  estimatedTotal?: number;
}

/** A list payload paired with its cursor-pagination info. */
export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

/**
 * Map an `apiClient` list response (`{ data: T[], meta: { pagination } }`) into a
 * UI-friendly {@link Paginated}. When the backend omits `meta.pagination` (some
 * lists return a bare array under `data`), falls back to a single-page descriptor.
 */
export function toPaginated<T>(res: { data: T[]; meta?: ResponseMeta }): Paginated<T> {
  const pagination = res.meta?.pagination;
  const items = Array.isArray(res.data) ? res.data : [];
  return {
    items,
    pageInfo: {
      perPage: pagination?.per_page ?? items.length,
      next: pagination?.next ?? null,
      hasMore: pagination?.has_more ?? false,
      estimatedTotal: pagination?.estimated_total,
    },
  };
}

/**
 * The `meta.pagination` fields a cursor page reads — loose on purpose, so a
 * typed `api` response and a hand-shaped one both fit.
 */
export interface CursorPaginationMeta {
  has_more?: boolean;
  next?: string | null;
  estimated_total?: number;
}

/** A cursor page's forward cursor and the server's count, as {@link pageOf} reads them. */
export interface CursorPageInfo {
  /** The next page's cursor while `has_more` says there is one; `null` on the last page. */
  next: string | null;
  /** `estimated_total` — how many rows the list matches; `null` when the page does not say. */
  total: number | null;
}

/**
 * Read a list response's `meta.pagination` as a cursor page's `{ next, total }`:
 * the cursor only while `has_more` is true (a stray `next` on the last page is
 * ignored), and the server's estimated count or `null`. The one mapping every
 * keyset list fetcher shares; {@link toPaginated} keeps the full descriptor.
 */
export function pageOf(pagination: CursorPaginationMeta | undefined): CursorPageInfo {
  return {
    next: pagination?.has_more ? (pagination.next ?? null) : null,
    total: pagination?.estimated_total ?? null,
  };
}
