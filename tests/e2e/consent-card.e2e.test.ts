import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import {
  byTestId,
  expectLoginFormReady,
  openAccountMenu,
} from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * The cookie card (`shared/components/ConsentBanner`) — claude.com's cookie banner, adapted
 * (iteration change-cookie-consent-2026-10-13-fmal): "Cookie settings" with Customize · Reject all
 * · Accept all, a Customize view with the categories, the answer in ONE first-party cookie for this
 * browser — so signing out never brings the card back — Global Privacy Control honored, and
 * "Privacy choices" on the signed-out frame. Plus its PLACEMENT, which only a browser can prove:
 * the bottom-START corner (the feedback trigger owns bottom-end), above the phone tab bar.
 *
 * The suite's shared storage state pre-answers the card (so it never gets in any other spec's
 * way); these tests start with no answer.
 */
const UNDECIDED = { cookies: [], origins: [] };
const CONSENT_COOKIE = 'clinozy-consent-preferences';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the element comes to rest. The card slides in, and its `duration-300` also times every
 * transition, so when the tab bar mounts its `bottom` glides clear of the bar over 300ms. Wait out
 * every running animation and transition on the element and on each element around it — a button
 * moves with the card's slide, which runs on the card, not on the button — then measure.
 */
async function boxOf(page: Page, testId: string): Promise<Box> {
  const element = byTestId(page, testId);
  await element.evaluate(async (node) => {
    const runningOnTheWayUp = () => {
      const running: Animation[] = [];
      for (let at: Element | null = node; at; at = at.parentElement) {
        running.push(...at.getAnimations());
      }
      return running;
    };
    for (
      let running = runningOnTheWayUp();
      running.length > 0;
      running = runningOnTheWayUp()
    ) {
      await Promise.all(
        running.map((animation) => animation.finished.catch(() => undefined)),
      );
    }
  });
  const box = await element.boundingBox();
  if (!box) throw new Error(`${testId} has no layout box`);
  return box;
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return Math.max(0, root.scrollWidth - window.innerWidth);
  });
}

/** The consent cookie's answer, decoded, or `null`. */
async function storedAnswer(
  context: BrowserContext,
): Promise<Record<string, unknown> | null> {
  const cookie = (await context.cookies()).find((item) => item.name === CONSENT_COOKIE);
  return cookie
    ? (JSON.parse(decodeURIComponent(cookie.value)) as Record<string, unknown>)
    : null;
}

async function openLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await expectLoginFormReady(page);
}

test.describe('Cookie card', () => {
  test.use({ storageState: UNDECIDED });

  test('a first visit asks with "Cookie settings": Customize, Reject all, Accept all', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLogin(page);

    await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible();
    // innerText: each button carries a short (phone) and a long label; CSS hides one.
    const rendered = { useInnerText: true };
    await expect(byTestId(page, 'consent-customize')).toHaveText(
      'Customize cookie settings',
      rendered,
    );
    await expect(byTestId(page, 'consent-reject')).toHaveText(
      'Reject all cookies',
      rendered,
    );
    await expect(byTestId(page, 'consent-accept')).toHaveText(
      'Accept all cookies',
      rendered,
    );
    await expect(page.getByTestId('consent-close')).toHaveCount(0);
  });

  test('sits in the bottom-start corner, at most 456px wide, the END corner free', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLogin(page);
    const card = await boxOf(page, 'consent-banner');

    expect(card.x).toBeLessThanOrEqual(32);
    expect(card.width).toBeLessThanOrEqual(456);
    expect(card.y + card.height).toBeLessThan(900);
    expect(card.x + card.width).toBeLessThan(1440 / 2);
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('gives Reject and Accept the same size', async ({ page }) => {
    await openLogin(page);
    const accept = await boxOf(page, 'consent-accept');
    const reject = await boxOf(page, 'consent-reject');

    expect(Math.abs(accept.width - reject.width)).toBeLessThanOrEqual(2);
    expect(accept.height).toBe(reject.height);
    expect(accept.y).toBe(reject.y);
  });

  test('mirrors to the other corner under RTL', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'locale-preference',
        JSON.stringify({ state: { locale: 'en', textDirection: 'rtl' }, version: 7 }),
      );
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(byTestId(page, 'consent-banner')).toBeVisible({ timeout: 15_000 });

    const card = await boxOf(page, 'consent-banner');
    expect(card.x).toBeGreaterThan(1440 / 2);
    expect(1440 - (card.x + card.width)).toBeLessThanOrEqual(32);
  });

  test('on a phone: an inset sheet with the three buttons in one row', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openLogin(page);
    const card = await boxOf(page, 'consent-banner');

    expect(card.x).toBeGreaterThanOrEqual(8);
    expect(card.x + card.width).toBeLessThanOrEqual(360 - 8);
    const customize = await boxOf(page, 'consent-customize');
    const reject = await boxOf(page, 'consent-reject');
    const accept = await boxOf(page, 'consent-accept');
    expect(customize.y).toBe(reject.y);
    expect(reject.y).toBe(accept.y);
    await expect(byTestId(page, 'consent-reject')).toHaveText('Reject', {
      useInnerText: true,
    });
    for (const button of [customize, reject, accept]) {
      expect(button.width).toBeGreaterThanOrEqual(72);
      expect(button.height).toBeGreaterThanOrEqual(36);
    }
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('Accept all is kept in the consent cookie and the card does not come back', async ({
    page,
    context,
  }) => {
    await openLogin(page);
    await byTestId(page, 'consent-accept').click();
    await expect(byTestId(page, 'consent-banner')).toBeHidden();
    expect(await storedAnswer(context)).toMatchObject({ analytics: true, version: 2 });

    await page.reload();
    await expectLoginFormReady(page);
    await expect(page.getByTestId('consent-banner')).toBeHidden();
  });

  test('Escape inside the card rejects all, and is remembered', async ({
    page,
    context,
  }) => {
    await openLogin(page);
    await byTestId(page, 'consent-reject').focus();
    await page.keyboard.press('Escape');
    await expect(byTestId(page, 'consent-banner')).toBeHidden();
    expect(await storedAnswer(context)).toMatchObject({ analytics: false });

    await page.reload();
    await expectLoginFormReady(page);
    await expect(page.getByTestId('consent-banner')).toBeHidden();
  });

  test('Customize: the categories in the same card, saved exactly as switched', async ({
    page,
    context,
  }) => {
    await openLogin(page);
    await byTestId(page, 'consent-customize').click();

    await expect(page.getByRole('switch', { name: 'Necessary' })).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Necessary' })).toBeChecked();
    const analytics = page.getByRole('switch', { name: 'Analytics' });
    await expect(analytics).toBeFocused();
    await expect(analytics).not.toBeChecked();
    await analytics.click();
    await byTestId(page, 'consent-save').click();

    await expect(byTestId(page, 'consent-banner')).toBeHidden();
    expect(await storedAnswer(context)).toMatchObject({ analytics: true });
  });

  test('"Privacy choices" on the signed-out frame reopens the card with the current answer', async ({
    page,
  }) => {
    await openLogin(page);
    await byTestId(page, 'consent-reject').click();
    await expect(byTestId(page, 'consent-banner')).toBeHidden();

    await byTestId(page, 'privacy-choices').click();
    await expect(byTestId(page, 'consent-banner')).toBeVisible();
    await byTestId(page, 'consent-customize').click();
    await expect(page.getByRole('switch', { name: 'Analytics' })).not.toBeChecked();
  });

  test('a browser that sends Global Privacy Control is never asked', async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
    });
    await openLogin(page);
    await expect(page.getByTestId('consent-banner')).toHaveCount(0);
    expect(await storedAnswer(context)).toBeNull();
  });

  test('asks again when the stored answer is to policy version 1, and drops the old one', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      {
        name: CONSENT_COOKIE,
        value: encodeURIComponent(
          JSON.stringify({
            analytics: true,
            version: 1,
            decidedAt: '2026-01-01T00:00:00.000Z',
          }),
        ),
        url: baseURL ?? 'http://localhost:5180',
      },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem(
        'clinozy-consent',
        JSON.stringify({ state: { analyticsConsent: 'granted' }, version: 1 }),
      );
    });
    await openLogin(page);
    await expect(byTestId(page, 'consent-banner')).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => localStorage.getItem('clinozy-consent'))).toBeNull();
  });

  test('signing out keeps this browser’s answer — the card does not come back', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    expect(
      await verifyDatabaseConnection(),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerNewUserAndGoToToday(page);

    // Answered while signed in: kept in the cookie, and sent to the account as a receipt
    // (clinozy-be audits it) — with the policy version it answers.
    const receipt = page.waitForResponse(
      (response) =>
        response.url().includes('/users/me/settings') &&
        response.request().method() === 'PATCH',
    );
    await byTestId(page, 'consent-accept').click();
    await expect(byTestId(page, 'consent-banner')).toBeHidden();
    const receiptResponse = await receipt;
    expect(receiptResponse.status()).toBe(200);
    expect(receiptResponse.request().postDataJSON()).toEqual({
      analytics_consent: 'granted',
      analytics_consent_version: 2,
    });

    await openAccountMenu(page);
    await byTestId(page, 'logout-button').click();
    await expectLoginFormReady(page);

    await expect(page.getByTestId('consent-banner')).toBeHidden();
    expect(await storedAnswer(context)).toMatchObject({ analytics: true });
  });

  test('rides above the mobile tab bar instead of covering it', async ({ page }) => {
    test.setTimeout(120_000);
    expect(
      await verifyDatabaseConnection(),
      'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    // The whole sign-up runs with the card still up — including the onboarding wizard, whose
    // Continue button sits at the very end of the page, exactly where a full-width card lands.
    // The page reserves the card's height at its end, so every step can be scrolled clear of it.
    await registerNewUserAndGoToToday(page);
    await expect(byTestId(page, 'consent-banner')).toBeVisible();

    const tabBar = await boxOf(page, 'mobile-bottom-bar');
    const card = await boxOf(page, 'consent-banner');

    expect(overlaps(card, tabBar)).toBe(false);
    expect(card.y + card.height).toBeLessThanOrEqual(tabBar.y);
  });
});
