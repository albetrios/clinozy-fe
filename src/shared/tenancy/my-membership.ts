import { fetchMeContext } from './me-context.ts';

/**
 * The caller's own membership id in `organizationId` (`mem_…`) — what "Mine", "(you)", an
 * owner filter and a sale's "Prescribed by" send — or `null` without one.
 *
 * @remarks
 * Read off a fresh session context (`membership_id` on `GET /auth/me/context`, N10), never the
 * cached one: an organization switch rewrites the cached context's organization, permissions
 * and role but not its membership id (the switch answers none), so the cache can name this
 * organization beside the previous one's membership. The hook keeps the answer for the session,
 * so this is one read per organization. While the server still answers for another organization
 * (the switch in flight) the read fails and its query retries — another workspace's membership
 * is never kept under this one.
 */
export async function findMyMembershipId(organizationId: string): Promise<string | null> {
  const context = await fetchMeContext();
  if (context.activeOrganization?.id === organizationId) return context.membershipId;
  throw new Error(
    `The session context answers for another organization than ${organizationId}`,
  );
}

/** The query key of the caller's membership id in one organization. */
export const myMembershipQueryKey = (organizationId: string | null) =>
  ['tenancy', 'my-membership', organizationId] as const;
