import type { Query } from '@tanstack/react-query';

import { queryClient } from '@/core/http/queryClient.ts';

/**
 * Whether a cached query belongs to `organizationId`.
 *
 * @remarks
 * Every organization-scoped key carries the organization's id as one of its parts —
 * `['app', 'patients', id, …]`, `['organization', id, …]`, `['billing', 'org', id, …]` (the key
 * convention in `TENANCY.PATTERNS.md`) — and an organization id (`org_…`) is never any other
 * part of a key. A key with no organization in it (me/context, the organization list, the
 * permission catalog) belongs to none.
 */
export function isOrganizationQuery(
  query: Pick<Query, 'queryKey'>,
  organizationId: string,
): boolean {
  return query.queryKey.includes(organizationId);
}

/**
 * Cancel every read of one organization that is still out — its answer, and any retry of it,
 * is then never written to the cache.
 *
 * @remarks
 * A workspace switch calls it: the token those reads carry is about to be retired, and a read
 * retried after the switch would go out with the next organization's token while its answer is
 * cached under this organization's key. A read with data keeps it (the fetch is reverted, not
 * the data). `null` (no organization) cancels nothing.
 */
export function cancelOrganizationQueries(organizationId: string | null): void {
  if (!organizationId) return;
  void queryClient.cancelQueries({
    predicate: (query) => isOrganizationQuery(query, organizationId),
  });
}

/**
 * Drop everything cached for one organization, so nothing read under an access the member no
 * longer has is shown again; a screen still mounted reads afresh.
 */
export function removeOrganizationQueries(organizationId: string): void {
  queryClient.removeQueries({
    predicate: (query) => isOrganizationQuery(query, organizationId),
  });
}
