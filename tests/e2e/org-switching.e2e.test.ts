import { expect, type Page, test } from '@playwright/test';

import {
  createTeamOrgAndOpenToday,
  navigateInApp,
  openOrganizationSwitcher,
  registerNewUserAndGoToToday,
  selectOrganizationInSwitcher,
} from '@/tests/utils/e2e-auth.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Organization switching through the section-bar shell's Account menu — its
 * "Switch clinic" row, shown once the member belongs to two or more workspaces.
 * Team ↔ team is the clinic case; personal ↔ team runs only where the deployment
 * still has personal workspaces.
 */

/** The `org` claim of a bearer token — read, never verified (the server does that). */
function organizationClaim(authorization: string): string | null {
  const payload = authorization.replace(/^Bearer\s+/i, '').split('.')[1] ?? '';
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      org?: unknown;
    };
    return typeof decoded.org === 'string' ? decoded.org : null;
  } catch {
    return null;
  }
}

/** Waits for a switcher option to show — the submenu animates in. */
async function optionShown(page: Page, slug: string): Promise<boolean> {
  return page
    .getByTestId(`organization-switcher-option-${slug}`)
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
}

test.describe('Organization switching (Account menu › Switch clinic)', () => {
  test.beforeEach(async () => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    );
  });

  test('switch clinic moves between two clinics', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const first = await createTeamOrgAndOpenToday(page);
    const second = await createTeamOrgAndOpenToday(page);

    await selectOrganizationInSwitcher(page, first.slug);
    // Landed: Today in the clinic switched to — its home picks the owner's role
    // home (D25) — and the menu is gone.
    await expect(page).toHaveURL(new RegExp(`/organization/${first.slug}/today`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('account-menu')).toHaveCount(0);

    await selectOrganizationInSwitcher(page, second.slug);
    await expect(page).toHaveURL(new RegExp(`/organization/${second.slug}/today`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
  });

  /*
   * clinozy-be keeps one live access token per session, scoped to the clinic the session was last
   * switched to. A second tab opening another clinic retires the first tab's token; the first
   * tab's refresh then answers with a token for the OTHER clinic. Carried, it would read and
   * write that clinic's records under this tab's screen — so the tab switches back first.
   */
  test('a tab keeps its own clinic when another tab moves the session', async ({
    page,
    context,
  }) => {
    await registerNewUserAndGoToToday(page);
    const first = await createTeamOrgAndOpenToday(page);
    const second = await createTeamOrgAndOpenToday(page);
    await selectOrganizationInSwitcher(page, first.slug);
    await expect(page).toHaveURL(new RegExp(`/organization/${first.slug}/today`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });

    // Tab two opens the second clinic: its switch moves the session to it.
    const otherTab = await context.newPage();
    await otherTab.goto(`/organization/${second.slug}/today`);
    await expect(otherTab.getByTestId('today-page')).toBeVisible({ timeout: 20000 });

    // Tab one carries on in the first clinic.
    const claims: string[] = [];
    page.on('request', (request) => {
      const authorization = request.headers().authorization;
      if (!authorization || !request.url().includes('/api/v1/app/')) return;
      claims.push(organizationClaim(authorization) ?? 'none');
    });
    const switchBack = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes('/auth/switch-to-organization'),
      { timeout: 20000 },
    );
    await navigateInApp(page, `/organization/${first.slug}/patients`);

    // Its refresh answered for the second clinic, so it switched back to its own first.
    const { organization_id: ownClinic } = (await switchBack).postDataJSON() as {
      organization_id: string;
    };
    await expect(page.getByTestId('patients-page')).toBeVisible({ timeout: 20000 });
    await expect.poll(() => claims.length, { timeout: 10000 }).toBeGreaterThan(0);
    // Every clinic request tab one sent names its own clinic — never the other tab's.
    expect(claims.filter((claim) => claim !== ownClinic)).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`/organization/${first.slug}/patients`));
    await otherTab.close();
  });

  test('switcher moves between the personal workspace and a team', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const team = await createTeamOrgAndOpenToday(page);

    await openOrganizationSwitcher(page);
    test.skip(
      !(await optionShown(page, 'personal')),
      'personal workspaces are off on this deployment',
    );
    // A personal workspace has no clinic (D44): it lands on the picker, whose
    // list leads back into one.
    await page.getByTestId('organization-switcher-option-personal').click();
    await expect(page).toHaveURL(/\/organization(?:[?#]|$)/, { timeout: 15000 });
    await expect(page.getByTestId('organization-page')).toBeVisible({ timeout: 15000 });

    await page.getByTestId(`organization-picker-option-${team.slug}`).click();
    await expect(page).toHaveURL(new RegExp(`/organization/${team.slug}/today`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
  });
});
