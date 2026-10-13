import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { acceptInvitation } from '@/shared/api/organization-api.ts';
import { silentRefresh } from '@/shared/auth/service.ts';

import { invalidateMyInvitations } from './my-invitations.ts';
import { invalidateMyOrganizationSummaries } from './my-organization-summaries.ts';
import { switchToOrganization } from './switch.ts';

/** What accepting an invitation came to. */
export interface AcceptedInvitation {
  /** The joined clinic. */
  organizationId: string;
  /** Its slug once this tab moved into it; `null` when the move failed. */
  slug: string | null;
  /** Why this tab could not be moved into the clinic — the membership exists all the same. */
  switchError: unknown;
}

/**
 * Accept an invitation and move this tab into the clinic — from the emailed link (`token`) or
 * from the app's invitations list (no token: the signed-in owner of the invited, verified email,
 * clinozy-be launch D84).
 *
 * @remarks
 * - **Two steps, two outcomes.** The accept makes the person a member; the switch and refresh
 *   behind it open the clinic in this tab. A failed accept throws; a failed switch does not — it
 *   comes back as `switchError`, because the join is real and the caller should say so rather
 *   than report a failure (INV-1).
 * - **Caches.** The invitations and the organization list both changed, so both are dropped.
 */
export async function acceptInvitationAndOpenClinic(
  invitationId: string,
  token?: string,
): Promise<AcceptedInvitation> {
  const accepted = await acceptInvitation(invitationId, token);
  captureAnalyticsEvent(ANALYTICS_EVENTS.inviteAccepted, {
    invitation_id: invitationId,
    organization_id: accepted.organizationId,
  });
  void invalidateMyInvitations();
  invalidateMyOrganizationSummaries();
  try {
    const ctx = await switchToOrganization(accepted.organizationId);
    await silentRefresh();
    return {
      organizationId: accepted.organizationId,
      slug: ctx?.activeOrganization?.slug ?? null,
      switchError: null,
    };
  } catch (switchError) {
    return { organizationId: accepted.organizationId, slug: null, switchError };
  }
}
