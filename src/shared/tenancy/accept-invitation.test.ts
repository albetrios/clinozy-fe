import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/organization-api.ts', () => ({ acceptInvitation: vi.fn() }));
vi.mock('@/shared/auth/service.ts', () => ({
  silentRefresh: vi.fn(async () => undefined),
}));
vi.mock('./switch.ts', () => ({ switchToOrganization: vi.fn() }));
vi.mock('@/shared/analytics/capture.ts', () => ({ captureAnalyticsEvent: vi.fn() }));
vi.mock('./my-invitations.ts', () => ({
  invalidateMyInvitations: vi.fn(async () => undefined),
}));
vi.mock('./my-organization-summaries.ts', () => ({
  invalidateMyOrganizationSummaries: vi.fn(),
}));

import { acceptInvitation } from '@/shared/api/organization-api.ts';
import { silentRefresh } from '@/shared/auth/service.ts';

import { acceptInvitationAndOpenClinic } from './accept-invitation.ts';
import { invalidateMyInvitations } from './my-invitations.ts';
import { invalidateMyOrganizationSummaries } from './my-organization-summaries.ts';
import { switchToOrganization } from './switch.ts';

const INVITATION_ID = `inv_${'a'.repeat(21)}`;
const ORGANIZATION_ID = `org_${'b'.repeat(21)}`;

afterEach(() => {
  vi.resetAllMocks();
});

describe('acceptInvitationAndOpenClinic', () => {
  it('accepts without a token from the app, moves into the clinic and drops the stale lists', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({ organizationId: ORGANIZATION_ID });
    vi.mocked(switchToOrganization).mockResolvedValue({
      activeOrganization: { slug: 'skin-studio' },
    } as never);

    expect(await acceptInvitationAndOpenClinic(INVITATION_ID)).toEqual({
      organizationId: ORGANIZATION_ID,
      slug: 'skin-studio',
      switchError: null,
    });
    expect(acceptInvitation).toHaveBeenCalledWith(INVITATION_ID, undefined);
    expect(switchToOrganization).toHaveBeenCalledWith(ORGANIZATION_ID);
    expect(silentRefresh).toHaveBeenCalledOnce();
    expect(invalidateMyInvitations).toHaveBeenCalledOnce();
    expect(invalidateMyOrganizationSummaries).toHaveBeenCalledOnce();
  });

  it('passes the link’s token on', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({ organizationId: ORGANIZATION_ID });
    vi.mocked(switchToOrganization).mockResolvedValue(undefined);

    await acceptInvitationAndOpenClinic(INVITATION_ID, 'emailed-token');

    expect(acceptInvitation).toHaveBeenCalledWith(INVITATION_ID, 'emailed-token');
  });

  it('a failed switch is not a failed join — it comes back as switchError', async () => {
    const switchError = new Error('switch failed');
    vi.mocked(acceptInvitation).mockResolvedValue({ organizationId: ORGANIZATION_ID });
    vi.mocked(switchToOrganization).mockRejectedValue(switchError);

    expect(await acceptInvitationAndOpenClinic(INVITATION_ID)).toEqual({
      organizationId: ORGANIZATION_ID,
      slug: null,
      switchError,
    });
  });

  it('a refused accept throws, and nothing is switched', async () => {
    vi.mocked(acceptInvitation).mockRejectedValue(new Error('invitation_expired'));

    await expect(acceptInvitationAndOpenClinic(INVITATION_ID)).rejects.toThrow(
      'invitation_expired',
    );
    expect(switchToOrganization).not.toHaveBeenCalled();
  });
});
