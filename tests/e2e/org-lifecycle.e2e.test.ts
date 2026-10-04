import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  createTeamOrgAndOpenDashboard,
  navigateInApp,
  registerNewUserAndGoToDashboard,
} from '@/tests/utils/e2e-auth.ts';
import { byTestId, openSettingsHash } from '@/tests/utils/e2e-hybrid.ts';
import {
  createSessionViaEmailCode,
  pollInvitationTokenFromMailOutbox,
  uniqueE2eEmail,
  verifyDatabaseConnection,
} from '@/tests/utils/e2e-session.ts';

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
    await registerNewUserAndGoToDashboard(page);
    const switcher = page.getByTestId('organization-switcher-trigger').first();
    const switcherShown = await switcher
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    // The switcher is what this test reads the new name from.
    test.skip(!switcherShown, 'org switcher hidden');
    const { slug } = await createTeamOrgAndOpenDashboard(page);

    await openSettingsHash(page, 'organization', 'general');
    await expect(page.getByTestId('settings-section-org-general')).toBeVisible({
      timeout: 10_000,
    });

    const renamed = `Renamed ${slug.slice(-5)}`;
    await page.getByTestId('org-name').fill(renamed);
    await page.getByTestId('org-general-save').click();

    // The slug is immutable from this panel; the URL must keep it.
    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/`));
    await page.keyboard.press('Escape');
    await expect(
      page.getByTestId('organization-switcher-trigger').locator('visible=true').first(),
    ).toContainText(renamed, { timeout: 15_000 });
  });

  test('an active organization cannot be talked into its own suspended page', async ({
    page,
  }) => {
    // Regression: `…/suspended` sits outside `requireOrgStatus` so a suspended
    // organization can render its blocked state without redirect-looping. That
    // exemption used to mean unguarded in BOTH directions — typing the URL told
    // the owner of a demonstrably active organization that it was suspended,
    // while the dashboard one click away still showed it as Active.
    test.setTimeout(150_000);
    await registerNewUserAndGoToDashboard(page);
    const { slug } = await createTeamOrgAndOpenDashboard(page);

    await page.goto(`/organization/${slug}/suspended`);

    await expect(page).toHaveURL(new RegExp(`/organization/${slug}/dashboard`), {
      timeout: 15_000,
    });
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 15_000 });
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
      await registerNewUserAndGoToDashboard(page);
      const { slug } = await createTeamOrgAndOpenDashboard(page);

      // Invite through the Users room's "New user" — the members surface (D17).
      await navigateInApp(page, `/organization/${slug}/users/create`);
      await expect(page.getByTestId('user-drawer')).toBeVisible({ timeout: 10_000 });
      await byTestId(page, 'user-drawer-name').fill('Lifecycle Invitee');
      await byTestId(page, 'user-drawer-email').fill(inviteeEmail);
      await byTestId(page, 'user-drawer-save').click();
      const row = page
        .getByTestId('users-team-table-row')
        .filter({ hasText: 'Lifecycle Invitee' });
      await expect(row).toHaveCount(1, { timeout: 15_000 });

      // Accept via API as the invitee — both the invitation id and the raw
      // token live only in the emailed accept link.
      const invitationToken = await pollInvitationTokenFromMailOutbox(inviteeEmail);
      const invitationId = await pollInvitationIdFromMailOutbox(inviteeEmail);
      inviteeApi = await playwright.request.newContext({ baseURL: HOST });
      const invitee = await createSessionViaEmailCode(inviteeApi, inviteeEmail);
      const accept = await inviteeApi.post(
        `${API}/tenancy/invitations/${invitationId}/accept`,
        {
          headers: { Authorization: `Bearer ${invitee.accessToken}` },
          data: { token: invitationToken },
        },
      );
      expect(accept.ok(), `accept failed: ${accept.status()}`).toBe(true);

      // Owner promotes the member to Admin from their drawer. Navigate away and
      // back instead of reloading: an authenticated reload currently trips the
      // double-refresh CSRF race (see cross-tab/locale-rtl fixmes), and a
      // remount refetches the roster just as well.
      await navigateInApp(page, `/organization/${slug}/users/roles`);
      await navigateInApp(page, `/organization/${slug}/users`);
      await row.click();
      await expect(page.getByTestId('user-drawer')).toBeVisible({ timeout: 10_000 });
      await byTestId(page, 'user-drawer-roles-admin').click();
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
