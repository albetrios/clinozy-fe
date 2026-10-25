import { expect, type Page, test } from '@playwright/test';

import {
  APP_ROOMS,
  APP_VIEWPORTS,
  expectRoomLoaded,
  openNewClinic,
  openRoomFromShell,
} from '@/tests/utils/e2e-app.ts';
import { navigateInApp, registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import {
  DARK_HTML_CLASS,
  expectAuthScreenReady,
  gotoApp,
  seedDarkMode,
} from '@/tests/utils/e2e-hybrid.ts';
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
/**
 * The sign-in screen's tour paints the viewer's clock and day — the sheet's rows, its open or
 * closed state, the time in its headlines — so its shots hold one: {@link FIXED_NOW} in the
 * clinic's zone (Monday 15:30, the sheet open). Date only, as Today's shot: timers keep running.
 */
async function pinTheTourClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
}

async function settled(page: Page): Promise<void> {
  await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 30_000 });
  await page.addStyleTag({ content: HIDE_TRANSIENT });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('Visual Regression', () => {
  test.describe('the sign-in screen', () => {
    // The tour's clock reads in the viewer's zone: the clinic's, wherever CI runs.
    test.use({ timezoneId: 'Asia/Kolkata' });

    test('login page (light mode)', async ({ page }) => {
      await pinTheTourClock(page);
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
      await pinTheTourClock(page);
      await seedDarkMode(page);
      await gotoApp(page, '/login');
      await expectAuthScreenReady(page);
      await settled(page);
      await expect(page.locator('html')).toHaveClass(DARK_HTML_CLASS);
      await expect(page).toHaveScreenshot('login-dark.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });

    test('login page (theme extremes — floating elevation + glow focus)', async ({
      page,
    }) => {
      await pinTheTourClock(page);
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
      await pinTheTourClock(page);
      await seedDarkMode(page);
      await gotoApp(page, '/login');
      await page.evaluate(() => {
        document.documentElement.dataset.separation = 'hairline';
        document.documentElement.dataset.menu = 'glass';
      });
      await expectAuthScreenReady(page);
      await settled(page);
      await expect(page.locator('html')).toHaveClass(DARK_HTML_CLASS);
      await expect(page).toHaveScreenshot('login-dark-glass-hairline.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  });

  // The clinic home: where a member lands — Today for a clinic's owner (D25).
  test('Today (the clinic home)', async ({ page }) => {
    // Date only: timers keep running, so boot, refresh and toasts behave as live.
    await page.clock.setFixedTime(FIXED_NOW);
    // One first name every run: the greeting's length decides whether its row
    // wraps, and a random full name moved the whole floor down when it did.
    await registerNewUserAndGoToToday(page, { firstName: 'Riya' });
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    // Loaded, not the first load's in-place skeleton: the page is busy until the
    // floor and the work queue have both answered.
    await expect(page.getByTestId('today-page')).not.toHaveAttribute('aria-busy', {
      timeout: 15000,
    });
    await settled(page);

    await expect(page).toHaveScreenshot('today.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
      // A new user every run: their avatar.
      mask: [page.getByTestId('user-menu-trigger')],
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
    await seedDarkMode(page);
    await gotoApp(page, '/definitely-not-a-route');
    await expect(page.getByTestId('not-found-page')).toBeVisible({ timeout: 10000 });
    await settled(page);
    await expect(page.locator('html')).toHaveClass(DARK_HTML_CLASS);
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

// Every room of a new clinic — light at desktop and at the phone's width, dark at desktop:
// the shell, the toolbars, the filters and each room's empty state. Empty, because a seeded
// row carries live times (booked "later today", created "2 min ago") that no fixed clock can
// hold still. One clinic per pass, every room in turn; each shot is soft, so one moved room
// still reports every other.
const ROOM_PASSES = [
  { tier: 'desktop', scheme: 'light' },
  { tier: 'phone', scheme: 'light' },
  { tier: 'desktop', scheme: 'dark' },
] as const;

test.describe('Visual Regression — clinic rooms', () => {
  for (const { tier, scheme } of ROOM_PASSES) {
    const variant = scheme === 'dark' ? 'dark' : tier;
    test(`every room of a new clinic (${tier}, ${scheme})`, async ({ page }) => {
      test.skip(
        !(await verifyDatabaseConnection()),
        'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
      );
      test.setTimeout(180_000);
      await page.setViewportSize(APP_VIEWPORTS[tier]);
      await page.clock.setFixedTime(FIXED_NOW);
      if (scheme === 'dark') await seedDarkMode(page);
      // One clinic name every run: the header shows it.
      await openNewClinic(page, { name: 'Riya Skin Clinic' });
      await settled(page);
      if (scheme === 'dark')
        await expect(page.locator('html')).toHaveClass(DARK_HTML_CLASS);

      for (const room of APP_ROOMS) {
        if (room !== 'today') await openRoomFromShell(page, room, tier);
        await expectRoomLoaded(page, room);
        if (room === 'today') {
          await expect(page.getByTestId('today-page')).not.toHaveAttribute('aria-busy', {
            timeout: 15_000,
          });
        }
        await expect.soft(page).toHaveScreenshot(`room-${room}-${variant}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.03,
          animations: 'disabled',
          // A new owner every run: their avatar, their name in Today's greeting, and their
          // row (name and email) in the team list.
          mask: [
            page.getByTestId('user-menu-trigger'),
            page.getByRole('heading', {
              level: 1,
              name: /^Good (morning|afternoon|evening)/,
            }),
            page.getByTestId('users-team-table-row'),
          ],
        });
      }
    });
  }
});
