import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import {
  findMyMembershipId,
  myMembershipQueryKey,
} from '@/shared/tenancy/my-membership.ts';

/**
 * The signed-in member's own membership id in the active organization (`mem_…`), for "Mine",
 * "(you)" and owner filters — `undefined` while it loads, `null` when there is none.
 *
 * @remarks
 * Read once per organization and kept for the session (a membership id never changes); see
 * `findMyMembershipId` for why it is looked up rather than read from the session (N10).
 */
export function useMyMembershipId(): string | null | undefined {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const query = useAppQuery({
    queryKey: myMembershipQueryKey(organizationId),
    queryFn: () => findMyMembershipId(userId as string),
    enabled: userId !== null && organizationId !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return query.data;
}
