import { expect, test } from '@playwright/test';

import { registerNewUserAndGoToDashboard } from '@/tests/utils/e2e-auth.ts';

test.describe('Onboarding', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('redirects provisioned users away from onboarding', async ({ page }) => {
    await registerNewUserAndGoToDashboard(page);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();

    await page.goto('/onboarding');
    await expect(page).not.toHaveURL(/\/onboarding/, { timeout: 10000 });
  });
});
