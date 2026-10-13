import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

const FAKE_NEW_BUILD = 'cross-browser-fake-build-id';

/**
 * A deployment the test ships on cue.
 *
 * Until {@link ship} runs, `version.json` is the preview's own — the build this
 * page is running, so no update. The cue matters because of WHEN the app looks:
 * its first check fires 2s after bootstrap, and the boot splash never leaves
 * before the wordmark lands at 2,050ms. A new build seen while the splash is up
 * reloads the tab at once — there is no screen to lose, so no toast is shown
 * (`check.ts` → `safeToReload`, QA-V3-7; pinned in `check.test.ts`). Advertised
 * from the first request, every check landed on the splash and the toast these
 * specs exist for never appeared, on all three engines.
 */
async function mockDeployment(page: Page) {
  let advertised = false;
  await page.route('**/version.json*', async (route) => {
    if (!advertised) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        buildId: FAKE_NEW_BUILD,
        builtAt: new Date().toISOString(),
      }),
    });
  });

  return {
    /**
     * Advertise the new build once the splash has left, then bring the tab back
     * into view — a `visibilitychange` to visible is the app's own "returned to
     * the tab" re-check, so the test does not wait out the 5-minute poll.
     */
    async ship() {
      await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 15_000 });
      advertised = true;
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    },
    /** The reload lands on the latest build: `version.json` names this one again. */
    landOnLatest() {
      advertised = false;
    },
  };
}

test.describe('version update notification', () => {
  // The production preview registers a service worker. Once it controls the page
  // it proxies `version.json`, and a service-worker-originated request is outside
  // `page.route()` in WebKit — the mock never applied there, so the app compared
  // the real build id against itself and no toast ever appeared. Blocking the
  // worker keeps the fetch on the page, where the route interception lives.
  // (The app itself is unaffected: version.json is never precached and
  // `check.ts` fetches it with `cache: 'no-store'`.)
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((namespace: string) => {
      try {
        sessionStorage.removeItem(`${namespace}:version-check:reloaded-for`);
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith(`${namespace}:version-check:snooze:`)) {
            sessionStorage.removeItem(key);
          }
        }
      } catch {
        // privacy mode — ignore
      }
    }, PRODUCT_NAMESPACE);
  });

  test('shows Update available toast when version.json differs', async ({ page }) => {
    const deployment = await mockDeployment(page);

    await page.goto('/login');
    await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 });
    await deployment.ship();

    await expect(page.getByTestId('app-toast')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Update available')).toBeVisible();
    await expect(page.getByTestId('toast-action')).toHaveText('Refresh now');
  });

  test('Refresh now triggers reload', async ({ page }) => {
    const deployment = await mockDeployment(page);

    await page.goto('/login');
    await deployment.ship();
    await expect(page.getByTestId('app-toast')).toBeVisible({ timeout: 15_000 });

    deployment.landOnLatest();
    const reloadPromise = page.waitForEvent('load');
    await page.getByTestId('toast-action').click();
    await reloadPromise;
    await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 });
  });

  test('dismiss snoozes without reloading', async ({ page }) => {
    const deployment = await mockDeployment(page);

    await page.goto('/login');
    await deployment.ship();
    await expect(page.getByTestId('app-toast')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('toast-dismiss').click();
    await expect(page.getByTestId('app-toast')).not.toBeVisible({ timeout: 5_000 });

    await page.waitForTimeout(3_000);
    expect(page.url()).toContain('/login');
    await expect(page.getByTestId('app-toast')).not.toBeVisible();
  });
});
