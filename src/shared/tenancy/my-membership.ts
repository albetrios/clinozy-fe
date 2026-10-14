import { fetchMeContext } from './me-context.ts';
import { ensureSessionContext } from './session-context.ts';

/**
 * The caller's own membership id in `organizationId` (`mem_…`) — what "Mine", "(you)", an
 * owner filter and a sale's "Prescribed by" send — or `null` without one.
 *
 * @remarks
 * Read off the session context (`membership_id` on `GET /auth/me/context`, N10), cache-first:
 * the guards and an organization switch have usually written it already, so this sends nothing.
 * A cached context can still answer for the previous workspace for a moment after the tab moves
 * to another (the organization store moves first), so a context for another organization is
 * read again; while the server still answers for another one the read fails and its query
 * retries — another workspace's membership is never kept under this one.
 */
export async function findMyMembershipId(organizationId: string): Promise<string | null> {
  const cached = await ensureSessionContext();
  if (cached.activeOrganization?.id === organizationId) return cached.membershipId;
  const fresh = await fetchMeContext();
  if (fresh.activeOrganization?.id === organizationId) return fresh.membershipId;
  throw new Error(
    `The session context answers for another organization than ${organizationId}`,
  );
}

/** The query key of the caller's membership id in one organization. */
export const myMembershipQueryKey = (organizationId: string | null) =>
  ['tenancy', 'my-membership', organizationId] as const;
