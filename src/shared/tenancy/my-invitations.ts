import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { api, type ApiData } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { isoDateString, publicId } from '@/core/types/wire.ts';
import { fetchAllPages } from '@/shared/api/fetch-all-pages.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';

/*
 * The signed-in person's pending invitations (clinozy-be launch D84): read on their verified
 * email across clinics, accepted in the app without the emailed token, or declined. A person with
 * no clinic who has invitations sees them instead of "create a clinic"; one already in a clinic
 * sees them as "Invited" rows in the picker and the switcher.
 */

type ApiMyInvitation = NonNullable<
  ApiData<'/users/me/membership-invitations', 'get'>
>[number];

const myInvitationWire = wireSchema<ApiMyInvitation>()(
  z.object({
    id: publicId('inv'),
    organization: z.object({
      id: publicId('org'),
      name: z.string(),
      slug: z.string().nullable(),
      logo_url: z.string().nullable(),
    }),
    role_names: z.array(z.string()),
    inviter_name: z.string().nullable(),
    expires_at: isoDateString,
    created_at: isoDateString,
  }),
);

/** One pending invitation, as the invitations surfaces show it. */
export interface MyInvitation {
  id: string;
  organization: { id: string; name: string; slug: string | null; logoUrl: string | null };
  /** The roles the person would hold — the main role first. */
  roleNames: string[];
  /** Who invited them; `null` when clinozy-be knows no name. */
  inviterName: string | null;
  expiresAt: string;
}

/** Cache key for the caller's pending invitations. */
export const myInvitationsQueryKey = ['tenancy', 'my-invitations'] as const;

/** Every pending invitation of the signed-in person (`GET /users/me/membership-invitations`). */
export async function fetchMyInvitations(): Promise<MyInvitation[]> {
  const rows = await fetchAllPages(
    `${API_BASE_PATH}/users/me/membership-invitations`,
    myInvitationWire,
    'membership invitations',
  );
  return rows.map((row) => ({
    id: row.id,
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
      logoUrl: row.organization.logo_url,
    },
    roleNames: row.role_names,
    inviterName: row.inviter_name,
    expiresAt: row.expires_at,
  }));
}

/**
 * The invitations, from cache when they are there — for the guard chain and the sign-in hand-off,
 * which decide where a person without a clinic lands.
 *
 * @remarks Unlike the organization list this is not `staleTime: 'static'`: an invitation can
 * arrive at any time, so a cached answer older than the query's default stale time is fetched
 * again.
 */
export async function ensureMyInvitations(): Promise<MyInvitation[]> {
  return queryClient.query({
    queryKey: myInvitationsQueryKey,
    queryFn: fetchMyInvitations,
  });
}

/** Drop the cached invitations so the next read refetches (after an accept or a decline). */
export function invalidateMyInvitations(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: myInvitationsQueryKey });
}

/** The caller's pending invitations, for the picker and the switcher. No toast on failure. */
export function useMyInvitations(options: { enabled?: boolean } = {}) {
  return useAppQuery({
    queryKey: myInvitationsQueryKey,
    queryFn: fetchMyInvitations,
    enabled: options.enabled ?? true,
    notifyOnError: false,
  });
}

/**
 * Decline an invitation (`POST /tenancy/membership-invitations/:id/decline`): the invited
 * membership ends, its seat is freed and the inviter is told. Expired invitations can be declined
 * too.
 *
 * @remarks A 401 here is clinozy-be refusing the invitation for this account (another email),
 * not an expired session, so the refresh-and-replay is skipped.
 */
export async function declineInvitation(invitationId: string): Promise<void> {
  await api.post('/tenancy/membership-invitations/{membership_invitation_id}/decline', {
    params: { membership_invitation_id: invitationId },
    skip401: true,
  });
}
