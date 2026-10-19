import { expect, test } from '@playwright/test';

import { expectRoomReady } from '@/tests/utils/e2e-app.ts';
import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import {
  byTestId,
  expectAppHeaderReady,
  openAccountMenu,
} from '@/tests/utils/e2e-hybrid.ts';

/**
 * The clinic home (L-63): a member lands on their role home inside the clinic
 * shell — Today for a clinic's owner (D25) — and the shell around it works. The
 * pre-launch dashboard is retired; its `/dashboard` resolves as `/` does
 * (`routes-integration.e2e.test.ts`).
 */
test.describe('Clinic home', () => {
  test.beforeEach(async ({ page }) => {
    await registerNewUserAndGoToToday(page);
  });

  test(
    'lands on Today, greeted as the page heading',
    { tag: '@smoke' },
    async ({ page }) => {
      // Its URL, its page root and — the a11y guard — the greeting as its h1.
      await expectRoomReady(page, 'today');
      await expect(page.getByTestId('today-greeting')).toBeVisible();
    },
  );

  test('header elements are visible (hybrid)', async ({ page }) => {
    await expectAppHeaderReady(page);
  });

  test('the section bar carries the navigation', async ({ page }) => {
    // The clinic shell has no sidebar: one header bar, its "Sections" nav holding
    // All sections and the pinned tabs (KICKOFF §3.2).
    await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
    await expect(byTestId(page, 'all-sections-trigger')).toBeVisible();
  });

  test('Settings in the Account menu opens the settings modal over Today', async ({
    page,
  }) => {
    await openAccountMenu(page);
    await byTestId(page, 'user-menu-settings').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await expect(page).toHaveURL(/#settings\/account\/profile$/);
    // Today stays mounted behind the modal.
    await expect(page.getByTestId('today-page')).toBeAttached();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-modal')).not.toBeVisible();
    await expect(page).not.toHaveURL(/#settings/);
  });

  test('the user menu exposes Settings and Logout actions', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByTestId('user-menu-settings')).toBeVisible();
    await expect(page.getByTestId('logout-button')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
  });
});

/**
 * Console hygiene — kept out of the main describe so the listener is attached
 * before Today ever mounts (its beforeEach navigation happens first, and a hard
 * reload drops the in-memory access token).
 */
test.describe('Clinic home console hygiene', () => {
  test('mounts without React state-update warnings', async ({ page }) => {
    // Broad canary for render-phase state updates on the landing — the class of
    // bug a race makes intermittent, so it guards the class, not one instance.
    const reactWarnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      const text = message.text();
      if (/Cannot update a component|setState.*while rendering/i.test(text)) {
        reactWarnings.push(text.slice(0, 200));
      }
    });

    await registerNewUserAndGoToToday(page);
    await expect(page.getByTestId('today-page')).toBeVisible();
    // Let the landing's first queries settle and the floor paint.
    await page.waitForTimeout(2000);

    expect(reactWarnings).toEqual([]);
  });
});
