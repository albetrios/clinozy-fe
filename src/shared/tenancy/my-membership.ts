import { ensureSessionContext } from './session-context.ts';

/**
 * The caller's own membership id in the active organization (`mem_…`) — what "Mine",
 * "(you)" and an owner filter send — or `null` without one.
 *
 * @remarks
 * Read off the session context (`membership_id` on `GET /auth/me/context`, N10), cache-first:
 * the guards and an organization switch have usually written it already, so this sends nothing.
 */
export async function findMyMembershipId(): Promise<string | null> {
  return (await ensureSessionContext()).membershipId;
}

/** The query key of the caller's membership id in one organization. */
export const myMembershipQueryKey = (organizationId: string | null) =>
  ['tenancy', 'my-membership', organizationId] as const;
