import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

/** One row of clinozy-be's member picker (`GET /app/memberships`), as the API types it. */
type ApiMembershipPick = NonNullable<ApiData<'/app/memberships', 'get'>>[number];

const membershipPickWire = wireSchema<ApiMembershipPick>()(
  z.object({
    id: z.string(),
    user_id: z.string(),
    display_name: z.string(),
  }),
);

/** The picker's page size cap (clinozy-be lists at most 100 at a time). */
const PAGE_SIZE = 100;

/** How many pages the search reads before giving up — 2,000 members. */
const MAX_PAGES = 20;

/**
 * The caller's own membership id in the active organization (`mem_…`) — what "Mine",
 * "(you)" and an owner filter send — or `null` when the list has no row for them.
 *
 * @remarks
 * `GET /auth/me/context` does not carry it yet (backend request N10; api-integration §8 G0),
 * so the member picker is read page by page until the row whose `user_id` is the caller's;
 * the picker has no `user_id` filter. Once per organization (callers cache it).
 */
export async function findMyMembershipId(userId: string): Promise<string | null> {
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await api.get('/app/memberships', {
      query: { limit: PAGE_SIZE, include_ended: 'false', after },
    });
    const rows = z.array(membershipPickWire).parse(response.data ?? []);
    const mine = rows.find((row) => row.user_id === userId);
    if (mine) return mine.id;
    const next = response.meta?.pagination?.next;
    if (!next) return null;
    after = next;
  }
  return null;
}

/** The query key of the caller's membership id in one organization. */
export const myMembershipQueryKey = (organizationId: string | null) =>
  ['tenancy', 'my-membership', organizationId] as const;
