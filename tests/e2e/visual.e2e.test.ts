import { expect, type Page, test } from '@playwright/test';

import { navigateInApp, registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import { expectAuthScreenReady, gotoApp } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * The instant Today's clinic clock reads: its greeting and the floor's fixture
 * day follow it. Noon-ish UTC is 5 Oct everywhere from UTC−9 to UTC+13, and it
 * is in the past, so a session minted now never reads as expired.
 */
const FIXED_NOW = new Date('2026-10-05T10:00:00Z');

/**
 * Hidden in every shot: toasts (a sign-up's "Welcome! Your workspace is ready."
 * is still up when the shot is taken) and the dev-only query devtools button
 * (`VITE_DEVTOOLS`, a server setting, not the product).
 */
const HIDE_TRANSIENT =
  '[data-sonner-toaster], .tsqd-parent-container { display: none !important; }';

/**
 * The settled screen: the boot splash (index.html's `#app-splash`) gone — a
 * cold load renders the route under the splash first, so a 404 is "visible"
 * while the splash still covers it — and the transient layers hidden.
 */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 30_000 });
  await page.addStyleTag({ content: HIDE_TRANSIENT });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('Visual Regression', () => {
  test('login page (light mode)', async ({ page }) => {
    await gotoApp(page, '/login');
    await expectAuthScreenReady(page);
    await settled(page);
    await expect(page).toHaveScreenshot('login-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('login page (dark mode)', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expectAuthScreenReady(page);
    await settled(page);
    await expect(page).toHaveScreenshot('login-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('login page (theme extremes — floating elevation + glow focus)', async ({
    page,
  }) => {
    await gotoApp(page, '/login');
    await page.evaluate(() => {
      document.documentElement.dataset.elevation = 'floating';
      document.documentElement.dataset.focus = 'glow';
    });
    await expectAuthScreenReady(page);
    await settled(page);
    await expect(page).toHaveScreenshot('login-theme-extremes.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('login page (dark + hairline separation)', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.separation = 'hairline';
      document.documentElement.dataset.menu = 'glass';
    });
    await expectAuthScreenReady(page);
    await settled(page);
    await expect(page).toHaveScreenshot('login-dark-glass-hairline.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  // The clinic home: where a member lands — Today for a clinic's owner (D25).
  test('Today (the clinic home)', async ({ page }) => {
    // Date only: timers keep running, so boot, refresh and toasts behave as live.
    await page.clock.setFixedTime(FIXED_NOW);
    await registerNewUserAndGoToToday(page);
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    await settled(page);

    await expect(page).toHaveScreenshot('today.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
      // A new user every run: their name in the greeting and their initials.
      mask: [page.getByTestId('today-greeting'), page.getByTestId('user-menu-trigger')],
    });
  });

  test('404 page (light mode)', async ({ page }) => {
    await gotoApp(page, '/definitely-not-a-route');
    await expect(page.getByTestId('not-found-page')).toBeVisible({ timeout: 10000 });
    await settled(page);
    await expect(page).toHaveScreenshot('404-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('404 page (dark mode)', async ({ page }) => {
    await gotoApp(page, '/definitely-not-a-route');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(page.getByTestId('not-found-page')).toBeVisible({ timeout: 10000 });
    await settled(page);
    await expect(page).toHaveScreenshot('404-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('accept-invite error card (light mode)', async ({ page }) => {
    // The error card is a SIGNED-IN state: the route is auth-required (INV-4), so a
    // guest is redirected to sign-in before this page ever renders.
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (mail_outbox)',
    );
    await registerNewUserAndGoToToday(page);
    await navigateInApp(page, '/accept-invite/inv_expired');
    await expect(page.getByTestId('accept-invite-error')).toBeVisible({
      timeout: 10000,
    });
    await settled(page);
    await expect(page).toHaveScreenshot('accept-invite-error-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});
