import { onOrganizationAccessRefused, queryClient } from '@/core/http/queryClient.ts';
import { isClientRefusal } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  fetchMyOrganizationSummaries,
  myOrganizationsQueryKey,
} from './my-organization-summaries.ts';
import { getActiveOrganizationId } from './organization-context.ts';
import { removeOrganizationQueries } from './organization-queries.ts';
import { hydrateSessionContext } from './session-context.ts';

/**
 * How long after one check a further refusal for the same clinic is left alone. A role that
 * never held a permission keeps being refused for it (a poll, a panel that asks anyway) — each
 * refusal must not cost two reads.
 */
const RECHECK_AFTER_MS = 30_000;

let checking = false;
let lastChecked: { organizationId: string; at: number } | null = null;

/** The permission set the store holds, order-free, to compare before and after a re-read. */
function heldPermissions(): string {
  return [...useOrganizationStore.getState().permissions].sort().join(',');
}

/**
 * Read me/context and the membership list again, and when the caller's access to the clinic
 * changed, drop what was read under the old access and run the guards again.
 */
async function recheckAccess(
  organizationId: string,
  revalidate: () => unknown,
): Promise<void> {
  const before = heldPermissions();
  const [context, memberships] = await Promise.all([
    // Seeds me/context and the store — the permissions every gated control reads.
    hydrateSessionContext().catch((error: unknown) => {
      // clinozy-be refuses me/context for a clinic the caller no longer belongs to.
      if (isClientRefusal(error)) return null;
      throw error;
    }),
    // Fresh, whatever the cache holds: the list a guard trusts is the one being questioned.
    queryClient.fetchQuery({
      queryKey: myOrganizationsQueryKey,
      queryFn: fetchMyOrganizationSummaries,
      staleTime: 0,
    }),
  ]);
  const stillMember =
    context?.activeOrganization?.id === organizationId &&
    memberships.some((organization) => organization.id === organizationId);
  if (stillMember && heldPermissions() === before) return;
  // What the old role (or the ended membership) read must not be shown again.
  removeOrganizationQueries(organizationId);
  await revalidate();
}

/**
 * Follow clinozy-be's word on the caller's access to the active clinic.
 *
 * @remarks
 * A role downgraded or a membership ended elsewhere leaves this tab with a permission set and a
 * cache read under the old access: patient files stayed on screen, served from cache for the
 * stale time, after the member could no longer open them (E-3). The first sign is a 403 that
 * questions the access itself (`missing_permission`, `not_a_member` —
 * `isOrganizationAccessRefusal`). On one, this reads me/context and the membership list again;
 * when the access changed, it drops that clinic's cached queries and calls `revalidate` — the
 * route guards, which 404 a clinic the user left and send a room the role no longer opens to
 * `/unauthorized`. A 403 the role always had changes nothing and costs nothing more for
 * {@link RECHECK_AFTER_MS}. One check at a time.
 *
 * @returns A function that stops following.
 */
export function startOrganizationAccessFollow({
  revalidate,
}: {
  revalidate: () => unknown;
}): () => void {
  return onOrganizationAccessRefused(() => {
    const organizationId = getActiveOrganizationId();
    if (!organizationId || checking) return;
    const now = Date.now();
    if (
      lastChecked?.organizationId === organizationId &&
      now - lastChecked.at < RECHECK_AFTER_MS
    ) {
      return;
    }
    lastChecked = { organizationId, at: now };
    checking = true;
    void recheckAccess(organizationId, revalidate)
      .catch(() => undefined)
      .finally(() => {
        checking = false;
      });
  });
}

/** Test-only: forget the last check. */
export function resetOrganizationAccessFollowForTests(): void {
  checking = false;
  lastChecked = null;
}
