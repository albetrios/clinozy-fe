import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  createTeamOrgAndOpenToday,
  navigateInApp,
  registerNewUserAndGoToToday,
} from '@/tests/utils/e2e-auth.ts';
import { byTestId, openAccountMenu, openSettingsHash } from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  pollInvitationTokenFromMailOutbox,
  uniqueE2eEmail,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';
import { bearerHeaders } from '@/tests/utils/e2e-tenancy.ts';

const HOST = 'http://localhost:3000';
const API = `${HOST}/api/v1`;

/**
 * Organization lifecycle edges beyond create/switch: rename, member role
 * change, and member removal — none had an E2E pin.
 */
test.describe('Organization lifecycle — rename, role change, removal', () => {
  test.beforeEach(async () => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    );
  });

  test('renaming the organization updates the switcher without a slug change', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await registerNewUserAndGoToToday(page);
    const { slug } = await createTeamOrgAndOpenToday(page);

    // The switcher is what this test reads the new name from: the Account menu's
    // "Switch clinic" row, which names the active workspace once there are two.
    await openAccountMenu(page);
    const switcher = page.getByTestId('organization-switcher-trigger');
    const switcherShown = await switcher
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!switcherShown, 'one workspace only — the Account menu shows no switcher');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('account-menu')).toHaveCount(0);

    await openSettingsHash(page, 'organization', 'general');
    await expect(page.getByTestId('settings-section-org-general')).toBeVisible({
      timeout: 10_000,
    });

    const renamed = `Renamed ${slug.slice(-5)}`;
    await page.getByTestId('org-name').fill(renamed);
    await page.getByTestId('org-general-save').click();

    // The slug is immutable from this panel; the URL must keep it.
    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/`));
    // Leave once the save has landed — an Escape while it is in flight meets the
    // form still dirty and asks "Discard unsaved changes?".
    await expect(
      page.getByTestId('app-toast').filter({ hasText: 'Organization updated' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('org-general-save')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-modal')).toHaveCount(0);
    await openAccountMenu(page);
    await expect(page.getByTestId('organization-switcher-trigger')).toContainText(
      renamed,
      {
        timeout: 15_000,
      },
    );
  });

  test('an active organization cannot be talked into its own suspended page', async ({
    page,
  }) => {
    // Regression: `…/suspended` sits outside `requireOrgStatus` so a suspended
    // organization can render its blocked state without redirect-looping. That
    // exemption used to mean unguarded in BOTH directions — typing the URL told
    // the owner of a demonstrably active organization that it was suspended,
    // while every room one click away treated it as Active.
    test.setTimeout(150_000);
    await registerNewUserAndGoToToday(page);
    const { slug } = await createTeamOrgAndOpenToday(page);

    await page.goto(`/organization/${slug}/suspended`);

    // Sent back to the clinic's home, which lands its owner on Today.
    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/today`), {
      timeout: 15_000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('suspended-page')).toHaveCount(0);
  });

  test('an invited member can be promoted and then removed by the owner', async ({
    page,
    playwright,
  }) => {
    test.setTimeout(180_000);
    const inviteeEmail = uniqueE2eEmail('lifecycle-invitee');
    let inviteeApi: APIRequestContext | undefined;

    try {
      await registerNewUserAndGoToToday(page);
      const { slug } = await createTeamOrgAndOpenToday(page);

      // Invite through the Users room's "New user" — the members surface (D17).
      await navigateInApp(page, `/organization/${slug}/users/create`);
      await expect(page.getByTestId('user-drawer')).toBeVisible({ timeout: 10_000 });
      await byTestId(page, 'user-drawer-email').fill(inviteeEmail);
      const invite = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/tenancy/organization/memberships'),
        { timeout: 15_000 },
      );
      await byTestId(page, 'user-drawer-save').click();
      // A fresh team organization sits on a one-seat plan in the local billing seed,
      // so the owner fills it and the invite is refused (`journeys` skips the same way).
      const invited = await invite;
      if (invited.status() === 409) {
        const body = (await invited.json()) as { error?: { reason?: string } };
        test.skip(
          body.error?.reason === 'seat_limit_reached',
          'team org seat limit reached in local billing seed',
        );
      }
      const row = page
        .getByTestId('users-team-table-row')
        .filter({ hasText: inviteeEmail });
      await expect(row).toHaveCount(1, { timeout: 15_000 });

      // Accept via API as the invitee — both the invitation id and the raw
      // token live only in the emailed accept link.
      const invitationToken = await pollInvitationTokenFromMailOutbox(inviteeEmail);
      const invitationId = await pollInvitationIdFromMailOutbox(inviteeEmail);
      inviteeApi = await playwright.request.newContext({ baseURL: HOST });
      const invitee = await createSessionViaEmailCode(inviteeApi, inviteeEmail);
      const accept = await inviteeApi.post(
        `${API}/tenancy/membership-invitations/${invitationId}/accept`,
        {
          // An accept is a write that requires its idempotency key (the `I` column of
          // docs/routes.txt); without one clinozy-be answers 422.
          headers: bearerHeaders(invitee.accessToken, true),
          data: { token: invitationToken },
        },
      );
      expect(accept.ok(), `accept failed: ${accept.status()}`).toBe(true);

      // Owner promotes the member to Admin from their drawer — on the roster read after the
      // accept. A remount alone keeps the cached roster while it is fresh, and a drawer opened
      // on the invitee's row saves with its old `updated_at`: clinozy-be refuses that as
      // `record_changed` (the stale-save guard), so the page loads the roster again.
      await page.reload();
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row).not.toContainText(/invited/i, { timeout: 15_000 });
      await row.click();
      await expect(page.getByTestId('user-drawer')).toBeVisible({ timeout: 10_000 });
      await page
        .locator('[data-testid^="user-drawer-roles-"]')
        .filter({ hasText: /^Admin$/ })
        .first()
        .click();
      await byTestId(page, 'user-drawer-save').click();
      await expect(row).toContainText(/admin/i, { timeout: 15_000 });

      // And removes them; the row leaves at once (the write runs after Undo).
      await row.getByRole('button', { name: 'Delete' }).click();
      // Removal always routes through the shared reason confirm.
      await byTestId(page, 'confirm-reason-not-needed').click();
      await page.getByTestId('confirm-accept').click({ timeout: 10_000 });
      await expect(row).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await inviteeApi?.dispose();
    }
  });
});

/** Reads the invitation id out of the emailed accept link. */
async function pollInvitationIdFromMailOutbox(email: string): Promise<string> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const result = await client.query<{ html: string }>(
        `SELECT html FROM auth.mail_outbox
         WHERE to_addresses @> $1::jsonb AND html ILIKE '%Accept Invitation%'
         ORDER BY id DESC LIMIT 1`,
        [JSON.stringify([email])],
      );
      const match = /\/accept-invite\/([A-Za-z0-9_-]+)/.exec(result.rows[0]?.html ?? '');
      if (match?.[1]) return match[1];
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await client.end();
  }
  throw new Error(`no invitation id in outbox for ${email}`);
}
