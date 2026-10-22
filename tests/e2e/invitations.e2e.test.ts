import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

import { openNewClinic } from '@/tests/utils/e2e-app.ts';
import {
  completeOnboardingWizard,
  loginViaEmailCodeUI,
  openOrganizationSwitcher,
} from '@/tests/utils/e2e-auth.ts';
import { byTestId, clickTestId } from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  uniqueE2eEmail,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';
import { createTeamInvitation } from '@/tests/utils/e2e-tenancy.ts';

/*
 * Invitations for the person signing in (clinozy-be launch D84): someone invited into a clinic who
 * has none sees their invitations instead of "create a clinic" and accepts or declines them in the
 * app, without the emailed link; someone already in a clinic lands as usual, with the invitation
 * counted on their avatar and listed under Switch clinic.
 *
 * Every invitation comes from a clinic a spec opens for the purpose. A new clinic's Free plan holds
 * one seat, its owner's, so `createTeamInvitation` first grants the clinic seats
 * (`grantInvitableSeats`); a `409 seat_limit_reached` after that fails the test.
 *
 * Local only: it needs clinozy-be on :3000 with team organizations on, and DATABASE_URL for the
 * sign-in codes.
 */

const API = '/api/v1';

/** A new clinic's owner invites `inviteeEmail`. */
async function inviteFromNewClinic(
  api: APIRequestContext,
  inviteeEmail: string,
): Promise<{ invitationId: string; orgSlug: string; inviterToken: string }> {
  const ownerToken = (await createSessionViaEmailCode(api)).accessToken;
  const { invitationId, orgSlug, teamToken } = await createTeamInvitation(
    api,
    ownerToken,
    inviteeEmail,
  );
  return { invitationId, orgSlug, inviterToken: teamToken };
}

/** Signs `email` in through the sign-in form and expects the invitations picker. */
async function signInToInvitations(
  page: Page,
  email: string,
  invitationId: string,
): Promise<void> {
  await loginViaEmailCodeUI(page, email);
  await expect(page).toHaveURL(/\/organization(?:[?#]|$)/);
  await expect(page.getByTestId('organization-page')).toBeVisible();
  // a11y guard: the screen names itself as the invitations, not "Select organization".
  await expect(page.getByRole('heading', { level: 1, name: /invited/i })).toBeVisible();
  await expect(
    page.getByTestId(`organization-picker-invitation-${invitationId}`),
  ).toBeVisible();
}

test.describe('Invitations for the person signing in (D84)', () => {
  let api: APIRequestContext;

  test.beforeEach(async ({ playwright }) => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    );
    api = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  });

  test.afterEach(async () => {
    await api?.dispose();
  });

  test('someone invited into no clinic accepts in the app and lands in it', async ({
    page,
  }) => {
    const email = uniqueE2eEmail('invited');
    const invitation = await inviteFromNewClinic(api, email);

    await signInToInvitations(page, email, invitation.invitationId);
    await clickTestId(
      page,
      `organization-picker-invitation-accept-${invitation.invitationId}`,
    );

    // The wizard asks only for their profile — never for a clinic of their own.
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
    await completeOnboardingWizard(page);
    await expect(page).toHaveURL(new RegExp(`/organization/${invitation.orgSlug}/`), {
      timeout: 20_000,
    });
    await expect(page.getByTestId('app-layout')).toBeVisible();
  });

  test('declining asks first, tells the inviter and moves the person on', async ({
    page,
  }) => {
    const email = uniqueE2eEmail('declines');
    const invitation = await inviteFromNewClinic(api, email);

    await signInToInvitations(page, email, invitation.invitationId);
    await clickTestId(
      page,
      `organization-picker-invitation-decline-${invitation.invitationId}`,
    );
    const dialog = page.getByTestId('organization-picker-decline-dialog');
    await expect(dialog).toBeVisible();
    // a11y guard: a confirmation, exposed as an alert dialog.
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await clickTestId(page, 'organization-picker-decline-confirm');

    // Nothing left to answer: on to onboarding, as anyone without a clinic.
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });

    await expect
      .poll(
        async () => {
          const response = await api.get(`${API}/notify/notifications?limit=50`, {
            headers: { Authorization: `Bearer ${invitation.inviterToken}` },
          });
          const body = (await response.json()) as { data?: { type: string }[] };
          return (body.data ?? []).some(
            (notification) => notification.type === 'membership.invite_declined',
          );
        },
        { timeout: 15_000, message: 'the inviter is told the invitation was declined' },
      )
      .toBe(true);
  });

  test('someone already in a clinic lands there, with the invitation counted', async ({
    page,
  }) => {
    const email = uniqueE2eEmail('member-invited');
    const invitation = await inviteFromNewClinic(api, email);

    const { slug } = await openNewClinic(page, { email });
    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/`));
    await expect(byTestId(page, 'user-menu-invitation-count')).toHaveText('1');

    await openOrganizationSwitcher(page);
    const invited = byTestId(
      page,
      `organization-switcher-invitation-${invitation.invitationId}`,
    );
    await expect(invited).toBeVisible();
    await invited.click();

    // The Invited row opens the picker, where Accept and Decline live — under the usual heading.
    await expect(page).toHaveURL(/\/organization(?:[?#]|$)/, { timeout: 15_000 });
    await expect(
      page.getByTestId(`organization-picker-invitation-${invitation.invitationId}`),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /invited/i }),
    ).not.toBeVisible();
  });
});
