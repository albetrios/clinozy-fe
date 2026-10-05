import { expect, type Page, test } from '@playwright/test';

import {
  createTeamOrgAndOpenToday,
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
