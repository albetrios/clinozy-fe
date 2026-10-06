import { expect, test } from '@playwright/test';

import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import { openAppearanceDrawer } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Locale & direction preferences through the Appearance drawer (the Account
 * menu's "Appearance & language" row) — the 11-locale
 * i18n runtime had no E2E pin. Direction and language must apply live to
 * `<html>` and survive a reload (persisted store + pre-paint init script).
 */
test.describe('Locale & RTL preferences', () => {
  test.beforeEach(async () => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    );
  });

  test('forcing RTL flips the document live and auto restores it', async ({ page }) => {
    test.setTimeout(120_000);
    await registerNewUserAndGoToToday(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await openAppearanceDrawer(page);
    await page.getByTestId('text-direction-rtl').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Back to auto restores the language's own direction.
    await page.getByTestId('text-direction-auto').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('RTL preference survives a reload on a signed-in page', async ({ page }) => {
    // Was parked while an authenticated reload fired two /auth/refresh calls and
    // the second force-logged the session out; the boot refresh is one
    // single-flight path now (`refreshAccessToken`), so a reload keeps the session.
    test.setTimeout(120_000);
    await registerNewUserAndGoToToday(page);
    await openAppearanceDrawer(page);
    await page.getByTestId('text-direction-rtl').click();
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('switching the UI language to Arabic translates and flips direction', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await registerNewUserAndGoToToday(page);

    await openAppearanceDrawer(page);
    const arabic = page.getByTestId('language-ar');
    const pickerShown = await arabic
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!pickerShown, 'single-locale build — language picker hidden');
    await arabic.click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar', {
      timeout: 15_000,
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar', {
      timeout: 20_000,
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
