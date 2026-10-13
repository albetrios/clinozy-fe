import { expect, test } from '@playwright/test';

import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import { chooseThemeMode, openAccountMenu } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Theme mode (light / dark / system) from the Account menu's Appearance pills —
 * the section-bar shell's home for what the old header's toggle did. Dark mode
 * is the `.dark` class on the document element (managed by useThemeStore), so
 * the assertion reads the real applied state, not just the menu.
 */

test.describe('Theme mode', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !(await verifyDatabaseConnection()),
      'DATABASE_URL must reach clinozy-be Postgres (mail_outbox)',
    );
    await registerNewUserAndGoToToday(page);
  });

  test('switches to dark and back to light', async ({ page }) => {
    const html = page.locator('html');

    await chooseThemeMode(page, 'dark');
    await expect(html).toHaveClass(/dark/);

    await chooseThemeMode(page, 'light');
    await expect(html).not.toHaveClass(/dark/);
  });

  test('exposes the system option', async ({ page }) => {
    await openAccountMenu(page);
    // All three modes are exposed and labelled, as one radio group.
    const appearance = page.getByRole('group', { name: 'Appearance' });
    await expect(appearance.getByRole('menuitemradio', { name: 'Light' })).toBeVisible();
    await expect(appearance.getByRole('menuitemradio', { name: 'Dark' })).toBeVisible();
    await expect(appearance.getByRole('menuitemradio', { name: 'System' })).toBeVisible();
    await expect(page.getByTestId('account-menu-theme-system')).toBeVisible();
  });

  test('dark selection persists across a full page reload', async ({ page }) => {
    const html = page.locator('html');

    await chooseThemeMode(page, 'dark');
    await expect(html).toHaveClass(/dark/);

    // useThemeStore persists to localStorage('theme-preference'); a cold reload
    // must re-apply .dark before first paint, not fall back to light/system.
    await page.reload();
    await expect(html).toHaveClass(/dark/, { timeout: 5000 });

    const persisted = await page.evaluate(() => localStorage.getItem('theme-preference'));
    expect(persisted).toContain('dark');
  });

  test('system mode follows the OS prefers-color-scheme', async ({ page }) => {
    const html = page.locator('html');

    await chooseThemeMode(page, 'system');

    // In system mode the applied theme tracks the emulated OS preference live
    // (useThemeStore re-applies on the matchMedia 'change' event).
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveClass(/dark/);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).not.toHaveClass(/dark/);
  });
});
