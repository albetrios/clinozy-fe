import { expect, test } from '@playwright/test';

import {
  loginViaEmailCodeUI,
  navigateInApp,
  registerNewUserAndGoToToday,
} from '@/tests/utils/e2e-auth.ts';
import { openAccountMenu, openNotificationCenter } from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  uniqueE2eEmail,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';
import { bearerHeaders, createTeamInvitation } from '@/tests/utils/e2e-tenancy.ts';

const API = '/api/v1';

/**
 * A real notification, made the way clinozy-be makes one (D84): a clinic's owner invites
 * someone, they decline, and the owner is told. Inviting needs a free seat, and a local
 * clinic's Free plan holds one — so where the local billing seed has no room the invite is
 * answered `409 seat_limit_reached` and the test skips, as the other invite journeys do. The
 * empty inbox needs nothing, so it runs on a fresh account below.
 */
test.describe('Notifications (from a declined invitation)', () => {
  test('the owner sees the decline in the notification center, counted', async ({
    page,
    playwright,
  }) => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (mail_outbox)',
    );
    const api = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    try {
      const owner = await createSessionViaEmailCode(api);
      const inviteeEmail = uniqueE2eEmail('declines');
      let invitationId: string;
      let orgSlug: string;
      try {
        ({ invitationId, orgSlug } = await createTeamInvitation(
          api,
          owner.accessToken,
          inviteeEmail,
        ));
      } catch (error) {
        if (error instanceof Error && error.message === 'SEAT_LIMIT_REACHED') {
          test.skip(true, 'team org seat limit reached in local billing seed');
        }
        throw error;
      }
      const invitee = await createSessionViaEmailCode(api, inviteeEmail);
      const declined = await api.post(
        `${API}/tenancy/membership-invitations/${invitationId}/decline`,
        { headers: bearerHeaders(invitee.accessToken, true) },
      );
      expect(declined.status()).toBe(200);

      await loginViaEmailCodeUI(page, owner.email);
      // Into the clinic by its address: where personal workspaces are on, a fresh sign-in
      // starts outside it, on the picker.
      await navigateInApp(page, `/organization/${orgSlug}`);
      await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 20_000 });
      // One unread item: the Account menu's Notifications row carries its count.
      await openAccountMenu(page);
      await expect(page.getByTestId('account-menu-notifications')).toHaveText(/1/, {
        timeout: 15_000,
      });
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('account-menu')).toHaveCount(0);

      await openNotificationCenter(page);
      const list = page.getByTestId('notifications-list');
      await expect(list).toBeVisible({ timeout: 15_000 });
      await expect(list.getByRole('button')).toHaveCount(1);
      await expect(list.getByRole('button').first()).toContainText(/declined/i);
    } finally {
      await api.dispose();
    }
  });
});

test.describe('Notification center (empty inbox)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (mail_outbox)',
    );
    await registerNewUserAndGoToToday(page);
  });

  test('a fresh account shows the empty-inbox state with mark-all hidden', async ({
    page,
  }) => {
    // No unread items → no count on the Account menu's Notifications row.
    await openAccountMenu(page);
    await expect(page.getByTestId('account-menu-notifications')).toHaveText(
      /^notifications$/i,
    );
    await page.getByTestId('account-menu-notifications').click();
    const popover = page.getByTestId('notification-popover');
    await expect(popover).toBeVisible();
    await expect(popover.getByTestId('empty-state')).toBeVisible();
    // MarkAllReadButton renders null when the inbox is empty (hidden entirely,
    // not merely disabled) — assert absence to match that contract.
    await expect(page.getByTestId('notification-mark-all')).toHaveCount(0);
    // The settings-link footer only renders when there ARE items, so it is
    // absent on an empty inbox.
    await expect(page.getByTestId('notification-settings-link')).toHaveCount(0);
  });

  test('the empty notification center closes on Escape', async ({ page }) => {
    await openNotificationCenter(page);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('notification-popover')).not.toBeVisible();
  });
});
