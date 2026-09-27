import { expect, type Page, test } from '@playwright/test';

import { registerNewUserAndGoToDashboard } from '@/tests/utils/e2e-auth.ts';
import { expectLoginFormReady } from '@/tests/utils/e2e-hybrid.ts';

/**
 * Responsive guardrails at the smallest supported width (320px).
 * The app must hold from 320px up to 27" — these assert the hard floor:
 * no horizontal scroll, and the settings modal collapses to its mobile layout.
 */
const SMALL_PHONE = { width: 320, height: 640 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };

/** Horizontal overflow in px — should be ~0 (allow 1px for sub-pixel rounding). */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('Responsive @ 320px', () => {
  test.use({ viewport: SMALL_PHONE });

  test('login page fits with no horizontal scroll', async ({ page }) => {
    await page.goto('/login');
    await expectLoginFormReady(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('dashboard (app shell) fits with no horizontal scroll', async ({ page }) => {
    await registerNewUserAndGoToDashboard(page);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    // Sidebar is an off-canvas drawer on mobile; content must not overflow.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('settings modal uses the mobile section picker (sidebar hidden) and fits', async ({
    page,
  }) => {
    await registerNewUserAndGoToDashboard(page);
    const orgPath = new URL(page.url()).pathname.replace(/\/$/, '');
    await page.goto(`${orgPath}#settings/account/profile`);

    await expect(page.getByTestId('settings-modal')).toBeVisible();
    // Mobile: the section <Select> drives nav; the desktop sidebar is hidden.
    await expect(page.getByTestId('settings-mobile-section')).toBeVisible();
    await expect(page.getByTestId('settings-nav')).toBeHidden();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});

test.describe('Responsive @ 768px (tablet)', () => {
  test.use({ viewport: TABLET });

  test('login page fits with no horizontal scroll', async ({ page }) => {
    await page.goto('/login');
    await expectLoginFormReady(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('dashboard (app shell) fits with no horizontal scroll', async ({ page }) => {
    await registerNewUserAndGoToDashboard(page);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});

test.describe('Responsive @ 1280px (desktop)', () => {
  test.use({ viewport: DESKTOP });

  test('settings modal shows the desktop nav sidebar (mobile picker hidden) and fits', async ({
    page,
  }) => {
    await registerNewUserAndGoToDashboard(page);
    const orgPath = new URL(page.url()).pathname.replace(/\/$/, '');
    await page.goto(`${orgPath}#settings/account/profile`);

    await expect(page.getByTestId('settings-modal')).toBeVisible();
    // Desktop: the sidebar nav drives navigation; the mobile <Select> is hidden
    // (inverse of the 320px case).
    await expect(page.getByTestId('settings-nav')).toBeVisible();
    await expect(page.getByTestId('settings-mobile-section')).toBeHidden();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
