import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as MyInvitationsModule from '@/shared/tenancy/my-invitations.ts';
import type { MyInvitation } from '@/shared/tenancy/my-invitations.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { InvitationList } from './InvitationList.tsx';

const navigateMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // The list is mounted at '/', so a real navigate would not move — capture the intent.
  useNavigate: () => navigateMock,
}));

const acceptMock = vi.hoisted(() => vi.fn());
vi.mock('@/shared/tenancy/accept-invitation.ts', () => ({
  acceptInvitationAndOpenClinic: acceptMock,
}));

const declineMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/shared/tenancy/my-invitations.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyInvitationsModule>()),
  declineInvitation: declineMock,
  invalidateMyInvitations: vi.fn(async () => undefined),
}));

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const INVITATION: MyInvitation = {
  id: `inv_${'i'.repeat(21)}`,
  organization: {
    id: `org_${'c'.repeat(21)}`,
    name: 'Skin Studio Adajan',
    slug: 'skin-studio',
    logoUrl: null,
  },
  roleNames: ['Doctor', 'Counsellor'],
  inviterName: 'Nikunj Mavani',
  expiresAt: '2026-10-17T10:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('InvitationList (D84)', () => {
  it('shows the clinic, the roles and who invited, the expiry, and its two answers', async () => {
    const { container } = renderWithProviders(
      <InvitationList invitations={[INVITATION]} />,
    );

    const row = await screen.findByTestId(
      `organization-picker-invitation-${INVITATION.id}`,
    );
    expect(row).toHaveTextContent('Skin Studio Adajan');
    expect(row).toHaveTextContent('Doctor, Counsellor · Invited by Nikunj Mavani');
    expect(row).toHaveTextContent(/Expires/);
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('accepts, then hands off to `/` — onboarding (profile only) or the clinic home', async () => {
    acceptMock.mockResolvedValue({
      organizationId: INVITATION.organization.id,
      slug: 'skin-studio',
      switchError: null,
    });
    const user = userEvent.setup();
    renderWithProviders(<InvitationList invitations={[INVITATION]} />);

    await user.click(
      await screen.findByTestId(`organization-picker-invitation-accept-${INVITATION.id}`),
    );

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true }),
    );
    expect(acceptMock).toHaveBeenCalledExactlyOnceWith(INVITATION.id);
    expect(notifyMock.warning).not.toHaveBeenCalled();
  });

  it('says so when the join worked but this tab could not move in, and still hands off', async () => {
    acceptMock.mockResolvedValue({
      organizationId: INVITATION.organization.id,
      slug: null,
      switchError: new Error('switch failed'),
    });
    const user = userEvent.setup();
    renderWithProviders(<InvitationList invitations={[INVITATION]} />);

    await user.click(
      await screen.findByTestId(`organization-picker-invitation-accept-${INVITATION.id}`),
    );

    await waitFor(() => expect(notifyMock.warning).toHaveBeenCalledOnce());
    expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true });
  });

  it('shows the server’s reason when the accept is refused, and stays', async () => {
    acceptMock.mockRejectedValue(new Error('This invitation has expired.'));
    const user = userEvent.setup();
    renderWithProviders(<InvitationList invitations={[INVITATION]} />);

    await user.click(
      await screen.findByTestId(`organization-picker-invitation-accept-${INVITATION.id}`),
    );

    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledOnce());
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('declines only after the confirm, and tells the person it is done', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvitationList invitations={[INVITATION]} />);

    await user.click(
      await screen.findByTestId(
        `organization-picker-invitation-decline-${INVITATION.id}`,
      ),
    );
    expect(declineMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Decline the invitation to Skin Studio Adajan?'),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('organization-picker-decline-confirm'));

    await waitFor(() =>
      expect(declineMock).toHaveBeenCalledExactlyOnceWith(INVITATION.id),
    );
    expect(notifyMock.success).toHaveBeenCalledWith('Invitation declined.');
  });
});
