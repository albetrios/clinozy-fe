import { expect, test } from '@playwright/test';

import {
  createTeamOrgAndOpenToday,
  registerNewUserAndGoToToday,
} from '@/tests/utils/e2e-auth.ts';
import { openSettingsHash } from '@/tests/utils/e2e-hybrid.ts';

test.describe('Settings modal (hash-driven)', () => {
  test.beforeEach(async ({ page }) => {
    await registerNewUserAndGoToToday(page);
  });

  test('opens from the user menu and writes the hash', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click();
    await expect(page.getByTestId('user-menu-settings')).toBeVisible();
    // A new clinic's setup rows ("Finish setup", "Clinic settings") come first; the identity row
    // — the profile — follows them.
    const identity = page.getByTestId('account-menu-identity');
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press('ArrowDown');
      if (await identity.evaluate((row) => row === document.activeElement)) break;
    }
    await expect(identity).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/#settings\/account\/profile$/);
  });

  test('deep link opens the requested section over the page', async ({ page }) => {
    await openSettingsHash(page, 'account', 'security');
    await expect(page.getByTestId('settings-section-security')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId('today-page')).toBeAttached();
  });

  test('account nav sections render profile and security panels', async ({ page }) => {
    await openSettingsHash(page, 'account', 'profile');
    await expect(page.getByTestId('settings-section-profile')).toBeVisible();

    await page.getByTestId('settings-nav-account-security').click();
    await expect(page).toHaveURL(/#settings\/account\/security$/);
    await expect(page.getByTestId('settings-section-security')).toBeVisible({
      timeout: 10000,
    });
  });

  test('an unknown section hash is rewritten to the canonical default deep link', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.location.hash = '#settings/account/does-not-exist-xyz';
    });
    await expect(page.getByTestId('settings-modal')).toBeVisible({ timeout: 15000 });
    // Invalid scope/section falls back to account/profile and the URL is canonicalized.
    await expect(page.getByTestId('settings-section-profile')).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/#settings\/account\/profile$/);
  });

  test('a bare settings hash opens account profile and canonicalizes the URL', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.location.hash = '#settings';
    });
    await expect(page.getByTestId('settings-modal')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('settings-section-profile')).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/#settings\/account\/profile$/);
  });

  test('closing the modal clears the settings hash so a refresh will not reopen it', async ({
    page,
  }) => {
    await openSettingsHash(page, 'account', 'security');
    await expect(page.getByTestId('settings-section-security')).toBeVisible({
      timeout: 10000,
    });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-modal')).not.toBeVisible();
    await expect(page).not.toHaveURL(/#settings/);
  });

  test('organization nav appears after creating a team org', async ({ page }) => {
    await createTeamOrgAndOpenToday(page);

    await openSettingsHash(page, 'account', 'profile');
    await page.getByTestId('settings-nav-organization-general').click();
    await expect(page).toHaveURL(/#settings\/organization\/general$/);
    await expect(page.getByTestId('settings-section-org-general')).toBeVisible({
      timeout: 10000,
    });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-modal')).not.toBeVisible();
  });
});
