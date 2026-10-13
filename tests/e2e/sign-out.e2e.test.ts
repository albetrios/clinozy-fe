import { expect, type Page, test } from '@playwright/test';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import {
  byTestId,
  clickTestId,
  expectAppHeaderReady,
  expectLoginFormReady,
} from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Signing out goes straight to the login screen
 * (iterations/fix-sign-out-straight-to-login-2026-10-13-jjlp).
 *
 * The app stays exactly as it is until the login screen replaces it: nothing it
 * shows is cleared before the page goes (`leaveForLogin` in
 * `shared/auth/service.ts`), the `/login` load skips the boot splash
 * (`skipAppSplashOnNextLoad` → `public/splash-init.js`), and the login screen
 * does not wait for the revoke still owed to the server.
 */

/** The sign-out still owed to the server (`shared/auth/service.ts`). */
const REVOKE_PENDING_KEY = `${PRODUCT_NAMESPACE}:logout-pending`;

/** sessionStorage key the page being left writes its screen into, as it goes. */
const SCREEN_AT_PAGEHIDE = 'e2e:screen-at-pagehide';

/** The text of what the app shows — the header and the page under it — as an expression. */
const SCREEN_TEXT = `(() => {
  const header = document.querySelector('[data-testid="header"]');
  const main = document.querySelector('main');
  return (header ? header.textContent : '') + '\\n' + (main ? main.textContent : '');
})()`;

/**
 * Record the screen when the browser takes the page away. Registered before the
 * sign-out, so it runs before the sign-out's own `pagehide` clean-up. Strings, not
 * functions: the app's CSP refuses `eval`.
 */
async function recordScreenAtPagehide(page: Page): Promise<string> {
  await page.evaluate(`window.addEventListener('pagehide', () => {
    sessionStorage.setItem('${SCREEN_AT_PAGEHIDE}', ${SCREEN_TEXT});
  }, { once: true })`);
  return page.evaluate<string>(SCREEN_TEXT);
}

/**
 * In every later document: count the frames on which the boot splash or React's
 * full-page loader is visible, until the login form is up.
 */
const TRACE_LOGIN_LOAD = `
(() => {
  const trace = { splashFrames: 0, loaderFrames: 0, frames: 0, skipped: false };
  window.__loginLoadTrace = trace;
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0;
  };
  const sample = () => {
    trace.frames += 1;
    trace.skipped = document.documentElement.classList.contains('app-splash-skip');
    if (visible(document.getElementById('app-splash'))) trace.splashFrames += 1;
    if (visible(document.querySelector('[data-testid="full-page-spinner"]'))) trace.loaderFrames += 1;
    if (!document.querySelector('[data-testid="auth-email-submit"]')) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();
`;

interface LoginLoadTrace {
  splashFrames: number;
  loaderFrames: number;
  frames: number;
  skipped: boolean;
}

async function signOutFromTheAccountMenu(page: Page): Promise<void> {
  await expectAppHeaderReady(page);
  await clickTestId(page, 'user-menu-trigger');
  await clickTestId(page, 'logout-button');
}

test.describe('Signing out goes straight to the login screen', () => {
  test.beforeEach(async () => {
    expect(
      await verifyDatabaseConnection(),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    ).toBe(true);
  });

  test('the app is unchanged on screen until the page goes', async ({ page }) => {
    test.setTimeout(120_000);
    await registerNewUserAndGoToToday(page);
    await expectAppHeaderReady(page);
    // Today loads its floor after the shell: compare against the settled screen,
    // not one still loading.
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect
      .poll(async () => {
        const first = await page.evaluate<string>(SCREEN_TEXT);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return first === (await page.evaluate<string>(SCREEN_TEXT));
      })
      .toBe(true);
    const before = await recordScreenAtPagehide(page);

    await signOutFromTheAccountMenu(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    // Before the fix the stores and the query cache were wiped first: the
    // header lost the user and the page under it fell back to loading.
    const atPagehide = await page.evaluate(
      (key) => sessionStorage.getItem(key),
      SCREEN_AT_PAGEHIDE,
    );
    expect(atPagehide).toBe(before);
  });

  test('the login screen follows with no splash and no full-page loader', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await registerNewUserAndGoToToday(page);
    await page.addInitScript(TRACE_LOGIN_LOAD);

    await signOutFromTheAccountMenu(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expectLoginFormReady(page);

    const trace = await page.evaluate(
      () => (window as unknown as { __loginLoadTrace: LoginLoadTrace }).__loginLoadTrace,
    );
    expect(trace.skipped).toBe(true);
    expect(trace.frames).toBeGreaterThan(0);
    expect(trace.splashFrames).toBe(0);
    expect(trace.loaderFrames).toBe(0);

    // One load only: opening the app again plays the splash as always.
    await page.reload({ waitUntil: 'commit' });
    await expect(page.locator('html')).not.toHaveClass(/app-splash-skip/);
    await expect(page.locator('#app-splash')).toBeVisible();
    await expectLoginFormReady(page);
  });

  test('the login screen does not wait for the server to finish the sign-out', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await registerNewUserAndGoToToday(page);
    // Hold the revoke, as a slow network does: the page leaves before its answer,
    // so the next load still owes the server the sign-out and refreshes to finish
    // it. Hold that refresh too — the login screen must show anyway.
    let releaseServer: () => void = () => {};
    const serverHeld = new Promise<void>((resolve) => {
      releaseServer = resolve;
    });
    for (const path of ['**/api/v1/auth/logout', '**/api/v1/auth/refresh']) {
      await page.route(path, async (route) => {
        await serverHeld;
        await route.continue().catch(() => undefined);
      });
    }

    await signOutFromTheAccountMenu(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(byTestId(page, 'auth-email-submit')).toBeVisible({ timeout: 4_000 });
    expect(
      await page.evaluate((key) => localStorage.getItem(key), REVOKE_PENDING_KEY),
    ).toBe('1');

    releaseServer();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), REVOKE_PENDING_KEY), {
        timeout: 15_000,
      })
      .toBeNull();
  });

  test('Back after a sign-out lands on the login screen, not the app', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await registerNewUserAndGoToToday(page);

    await signOutFromTheAccountMenu(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expectLoginFormReady(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(byTestId(page, 'user-menu-trigger')).toHaveCount(0);
  });
});
