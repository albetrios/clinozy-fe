import { expect, type Page, test } from '@playwright/test';

import {
  createTeamOrgAndOpenDashboard,
  openOrganizationSwitcher,
  registerNewUserAndGoToDashboard,
  selectOrganizationInSwitcher,
} from '@/tests/utils/e2e-auth.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Organization switching through the section-bar shell's Account menu — its
 * "Switch clinic" row, shown once the member belongs to two or more workspaces.
 * Team ↔ team is the clinic case; personal ↔ team runs only where the deployment
 * still has personal workspaces.
 */

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
    await registerNewUserAndGoToDashboard(page);
    const first = await createTeamOrgAndOpenDashboard(page);
    const second = await createTeamOrgAndOpenDashboard(page);

    await selectOrganizationInSwitcher(page, first.slug);
    await expect(page).toHaveURL(new RegExp(`/organization/${first.slug}/dashboard`), {
      timeout: 15000,
    });
    // Landed: the dashboard names the clinic switched to (and the menu is gone).
    await expect(page.getByTestId('dashboard-org-name')).toHaveText(first.name, {
      timeout: 15000,
    });
    await expect(page.getByTestId('account-menu')).toHaveCount(0);

    await selectOrganizationInSwitcher(page, second.slug);
    await expect(page).toHaveURL(new RegExp(`/organization/${second.slug}/dashboard`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('dashboard-org-name')).toHaveText(second.name, {
      timeout: 15000,
    });
  });

  test('switcher moves between the personal dashboard and a team', async ({ page }) => {
    await registerNewUserAndGoToDashboard(page);
    const team = await createTeamOrgAndOpenDashboard(page);

    await openOrganizationSwitcher(page);
    test.skip(
      !(await optionShown(page, 'personal')),
      'personal workspaces are off on this deployment',
    );
    await page.getByTestId('organization-switcher-option-personal').click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$|#)/, { timeout: 15000 });
    await expect(page.getByTestId('dashboard-org-name')).toHaveText('Personal', {
      timeout: 15000,
    });

    await selectOrganizationInSwitcher(page, team.slug);
    await expect(page).toHaveURL(new RegExp(`/organization/${team.slug}/dashboard`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('dashboard-org-name')).toHaveText(team.name, {
      timeout: 15000,
    });
  });
});
