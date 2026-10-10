import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: vi.fn() },
  isUnauthorized: () => false,
}));
vi.mock('@/core/http/api.ts', () => ({ api: { post: vi.fn() } }));

import { api } from '@/core/http/api.ts';
import { apiClient } from '@/core/http/fetch-client.ts';
import { queryClient } from '@/core/http/queryClient.ts';

import {
  declineInvitation,
  ensureMyInvitations,
  fetchMyInvitations,
  invalidateMyInvitations,
  myInvitationsQueryKey,
} from './my-invitations.ts';

const INVITATION_ID = `inv_${'a'.repeat(21)}`;
const ORGANIZATION_ID = `org_${'b'.repeat(21)}`;

/** One invitation as clinozy-be answers `GET /users/me/membership-invitations` (D84). */
const wireInvitation = {
  id: INVITATION_ID,
  organization: {
    id: ORGANIZATION_ID,
    name: 'Skin Studio Adajan',
    slug: 'skin-studio-adajan',
    logo_url: null,
  },
  role_names: ['Doctor', 'Counsellor'],
  inviter_name: 'Nikunj Mavani',
  expires_at: '2026-10-17T10:00:00.000Z',
  created_at: '2026-10-10T10:00:00.000Z',
};

afterEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
});

describe('my pending invitations', () => {
  it('reads them from clinozy-be — the clinic, the roles, who invited and the expiry', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [wireInvitation],
      meta: { pagination: { has_more: false, next: null } },
    } as never);

    expect(await fetchMyInvitations()).toEqual([
      {
        id: INVITATION_ID,
        organization: {
          id: ORGANIZATION_ID,
          name: 'Skin Studio Adajan',
          slug: 'skin-studio-adajan',
          logoUrl: null,
        },
        roleNames: ['Doctor', 'Counsellor'],
        inviterName: 'Nikunj Mavani',
        expiresAt: '2026-10-17T10:00:00.000Z',
      },
    ]);
    expect(vi.mocked(apiClient.get).mock.calls[0]?.[0]).toContain(
      '/users/me/membership-invitations?limit=',
    );
  });

  it('serves them from cache, and reads again once dropped', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [], meta: {} } as never);

    await ensureMyInvitations();
    await ensureMyInvitations();
    expect(apiClient.get).toHaveBeenCalledOnce();

    await invalidateMyInvitations();
    queryClient.removeQueries({ queryKey: myInvitationsQueryKey });
    await ensureMyInvitations();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('declines with POST …/decline, skipping the refresh-and-replay on a 401', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);

    await declineInvitation(INVITATION_ID);

    expect(api.post).toHaveBeenCalledWith(
      '/tenancy/membership-invitations/{membership_invitation_id}/decline',
      { params: { membership_invitation_id: INVITATION_ID }, skip401: true },
    );
  });
});
