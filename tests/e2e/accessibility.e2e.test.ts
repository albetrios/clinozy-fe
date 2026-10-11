import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { navigateInApp, registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import {
  clickTestId,
  expectAuthScreenReady,
  expectHybridVisible,
  gotoApp,
  openSettingsHash,
} from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function settleAnimations(page: Page) {
  await page.waitForTimeout(400);
}

test.describe('Accessibility', () => {
  test('login page has no critical a11y violations', async ({ page }) => {
    await gotoApp(page, '/login');
    await expectAuthScreenReady(page);
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toEqual([]);
  });

  // Auth-light utility/error pages — reachable without a session, so they run
  // fast and deterministically. Each must be axe-clean at critical/serious.
  const utilityPages = [
    { path: '/some-nonexistent-page', testId: 'not-found-page', label: '404' },
    { path: '/unauthorized', testId: 'unauthorized-page', label: 'unauthorized' },
    { path: '/mfa', testId: 'mfa-page', label: 'MFA' },
  ] as const;

  for (const { path, testId, label } of utilityPages) {
    test(`${label} page has no critical a11y violations`, async ({ page }) => {
      await gotoApp(page, path);
      await expect(page.getByTestId(testId)).toBeVisible({ timeout: 5000 });
      await settleAnimations(page);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      expect(critical).toEqual([]);
    });
  }

  test('Today — the clinic home — has no critical a11y violations', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    // Scan the loaded floor, not the first load's in-place skeleton.
    await expect(page.getByTestId('today-page')).not.toHaveAttribute('aria-busy', {
      timeout: 15000,
    });
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-slot="select-trigger"]')
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toEqual([]);
  });

  // An owner dims no lane, so the Today case above never meets a tile out of
  // focus. "Preview as" (Users › Roles) narrows the app to a role the way it
  // will look to that member: as a Doctor, five of the seven lanes recede.
  test('Today as a Doctor — lanes out of focus — has no critical a11y violations', async ({
    page,
  }) => {
    await registerNewUserAndGoToToday(page);
    const slug = /^\/organization\/([^/]+)\//.exec(new URL(page.url()).pathname)?.[1];
    expect(slug, 'landed outside a clinic').toBeTruthy();

    // The URL's `?role=` is a role id (D157): pick the Doctor preset from the list by its name.
    await navigateInApp(page, `/organization/${slug}/users/roles`);
    await page
      .locator('[data-testid^="users-roles-item-"]')
      .filter({ hasText: /^Doctor/ })
      .first()
      .click();
    await expectHybridVisible(page, 'users-role-preview', {
      role: 'button',
      name: /^preview as doctor$/i,
    });
    await clickTestId(page, 'users-role-preview');
    await expect(page.getByText(/^previewing as doctor/i).first()).toBeVisible();

    await navigateInApp(page, `/organization/${slug}/today`);
    await expect(page.getByTestId('today-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('today-page')).not.toHaveAttribute('aria-busy', {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-lane-arriving')).toHaveAttribute(
      'data-dimmed',
      'true',
    );
    await expect(page.getByTestId('today-lane-waiting')).not.toHaveAttribute(
      'data-dimmed',
    );
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-slot="select-trigger"]')
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toEqual([]);
  });

  test('accept-invite error state has no critical a11y violations', async ({ page }) => {
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
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toEqual([]);
  });

  test('settings modal (account profile) has no critical a11y violations', async ({
    page,
  }) => {
    await registerNewUserAndGoToToday(page);
    await openSettingsHash(page, 'account', 'profile');
    await expect(page.getByTestId('settings-section-profile')).toBeVisible({
      timeout: 10000,
    });
    await settleAnimations(page);

    // Scope to the dialog: the dimmed page behind the overlay legitimately
    // fails contrast checks and is not what this test certifies.
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('[role="dialog"]')
      .exclude('[data-slot="select-trigger"]')
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toEqual([]);
  });
});
