import { expect, type Page, test } from '@playwright/test';

import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import { uniqueE2eEmail } from '@/tests/utils/e2e-faker.ts';
import {
  clickTestId,
  expectLoginFormReady,
  fillTestId,
} from '@/tests/utils/e2e-hybrid.ts';

/**
 * Network-fault resilience — connectivity loss surfaces the global
 * OfflineIndicator (and recovers), and a failing /version.json poll endpoint
 * never takes the app down. No API server required, except for the cold-boot
 * block at the end, which signs a real user in through clinozy-be.
 */
test.describe('Network resilience', () => {
  test('offline banner appears on connectivity loss and clears on recovery', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await expectLoginFormReady(page);
    await expect(page.getByTestId('offline-indicator')).toHaveCount(0);

    await context.setOffline(true);
    await expect(page.getByTestId('offline-indicator')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId('offline-indicator')).toHaveCount(0);
  });

  test('app boots and stays interactive when /version.json is unreachable', async ({
    page,
  }) => {
    // Kill the new-deployment poll target before the app ever loads.
    await page.route('**/version.json', (route) => route.abort());

    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/login');
    await expectLoginFormReady(page);

    // Hybrid: fill via testid; assert value via label (a11y path still works).
    const email = uniqueE2eEmail('network');
    await fillTestId(page, 'auth-email', email);
    await expect(page.getByLabel(/^email$/i)).toHaveValue(email);

    expect(
      pageErrors,
      `uncaught page errors: ${pageErrors.map((e) => e.message).join(', ')}`,
    ).toHaveLength(0);
  });

  test('a 500 from send-code does not crash the app or falsely advance the flow', async ({
    page,
  }) => {
    // Force the sign-in request to fail server-side, before the app loads.
    await page.route('**/auth/email/send-code', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { type: 'request_error', code: 'server_error', detail: 'boom' },
          meta: { request_id: 'e2e-500' },
        }),
      }),
    );
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/login');
    await expectLoginFormReady(page);
    await fillTestId(page, 'auth-email', uniqueE2eEmail('resilience'));
    await clickTestId(page, 'auth-email-submit');

    // A server error must NOT advance to the verification step, and the form
    // stays interactive — no white screen, no uncaught error.
    await expect(page.getByTestId('auth-email-verify-panel')).toBeHidden();
    await expect(page.getByTestId('auth-email')).toBeVisible();
    expect(
      pageErrors,
      `uncaught page errors: ${pageErrors.map((e) => e.message).join(', ')}`,
    ).toHaveLength(0);
  });

  test('a 429 from send-code surfaces feedback instead of hanging the form', async ({
    page,
  }) => {
    // Rate-limit the sign-in request unconditionally — even the client's single
    // honored-Retry-After retry lands on another 429, so the error must surface.
    await page.route('**/auth/email/send-code', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'retry-after': '1' },
        body: JSON.stringify({
          error: {
            type: 'rate_limit_error',
            code: 'rate_limited',
            detail: 'Too many requests',
          },
          meta: { request_id: 'e2e-429' },
        }),
      }),
    );
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/login');
    await expectLoginFormReady(page);
    await fillTestId(page, 'auth-email', uniqueE2eEmail('rate-limited'));
    await clickTestId(page, 'auth-email-submit');

    // The flow must not falsely advance, and the user must SEE the failure —
    // a silent spinner on persistent 429s is the bug this test pins down.
    await expect(page.getByTestId('auth-email-error-banner')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('auth-email-verify-panel')).toBeHidden();

    // The form stays interactive for a later retry once the window passes.
    await expect(page.getByTestId('auth-email')).toBeEnabled();
    expect(
      pageErrors,
      `uncaught page errors: ${pageErrors.map((e) => e.message).join(', ')}`,
    ).toHaveLength(0);
  });

  test('the offline indicator survives rapid connectivity flapping', async ({
    page,
    context,
  }) => {
    await page.goto('/login');
    await expectLoginFormReady(page);

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await context.setOffline(true);
      await expect(page.getByTestId('offline-indicator')).toBeVisible();
      await context.setOffline(false);
      await expect(page.getByTestId('offline-indicator')).toHaveCount(0);
    }
  });
});

/*
 * A cold boot whose refresh or `me/context` got no usable answer (503) says nothing about the
 * session — the refresh cookie is still good. The boot used to settle as signed out, and the
 * login page waited on that same settled boot: the visitor sat on the sign-in form until they
 * reloaded. Now the login page's guard asks again and lands them back where they were.
 */
test.describe('Cold boot without a usable answer', () => {
  /** Answers the first `count` requests matching `pattern` with a 503, then lets the rest through. */
  async function failFirst(page: Page, pattern: string, count: number): Promise<void> {
    let failed = 0;
    await page.route(pattern, async (route) => {
      if (failed < count) {
        failed += 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { detail: 'Service unavailable' } }),
        });
        return;
      }
      await route.continue();
    });
  }

  test('a 503 on me/context at boot keeps the session', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const todayUrl = page.url();

    // The fetch client retries a GET up to HTTP.MAX_RETRIES (3) times itself, so four answers
    // fail before the boot sees the 503.
    await failFirst(page, '**/api/v1/auth/me/context', 4);
    await page.goto(todayUrl);

    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 20000 });
  });

  test('a refresh unanswered at boot (503 twice) keeps the session', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const todayUrl = page.url();

    // The refresh is retried once inside the boot, so both of its tries fail.
    await failFirst(page, '**/api/v1/auth/refresh', 2);
    await page.goto(todayUrl);

    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 20000 });
  });
});
