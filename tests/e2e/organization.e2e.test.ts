import { expect, type Page, test } from '@playwright/test';

import {
  createTeamOrgAndOpenToday,
  openOrganizationSwitcher,
  registerNewUserAndGoToToday,
} from '@/tests/utils/e2e-auth.ts';
import { byTestId, gotoApp, navigateAuthenticated } from '@/tests/utils/e2e-hybrid.ts';

/**
 * Opens "Create organization" where a member finds it: the organization picker
 * (`/organization`). The clinic shell's Switch clinic lists workspaces and creates
 * none (D44), so the picker is the one way into the create dialog.
 */
async function openCreateFromPicker(page: Page): Promise<void> {
  await registerNewUserAndGoToToday(page);
  await navigateAuthenticated(page, '/organization');
  await expect(page.getByTestId('organization-page')).toBeVisible({ timeout: 10000 });
  await byTestId(page, 'organization-picker-create').click();
  await expect(page.getByTestId('create-organization-dialog-form')).toBeVisible();
}

test.describe('Organization picker', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await gotoApp(page, '/organization');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('lists a provisioned member’s clinic and leads back into it', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const slug = /^\/organization\/([^/]+)\//.exec(new URL(page.url()).pathname)?.[1];
    await navigateAuthenticated(page, '/organization');
    await expect(page.getByTestId('organization-page')).toBeVisible({ timeout: 10000 });

    await page.getByTestId(`organization-picker-option-${slug ?? ''}`).click();
    await expect(page).toHaveURL(new RegExp(`/organization/${slug ?? ''}/today`), {
      timeout: 15000,
    });
    await expect(page.getByTestId('today-page')).toBeVisible();
  });

  test('the switcher opens an accessible menu and closes on Escape', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const { slug } = await createTeamOrgAndOpenToday(page);
    await openOrganizationSwitcher(page);

    const option = page.getByTestId(`organization-switcher-option-${slug}`);
    await expect(option).toBeVisible({ timeout: 10000 });
    // a11y guard: a workspace is a menu item of the switcher's own menu.
    await expect(page.getByRole('menuitem', { name: new RegExp(slug) })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(option).toBeHidden();
  });

  test('the create-organization action opens the create dialog', async ({ page }) => {
    await openCreateFromPicker(page);
    await expect(page.getByTestId('create-organization-dialog-name')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /create organization/i }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('create-organization-dialog-form')).toBeHidden();
  });

  /**
   * QA-7: an invalid Workspace URL stopped the submit and said nothing at all —
   * the dialog stayed open, the page did not move, and the form held no
   * `role="alert"`. Pressing Create looked like a dead button.
   */
  test('an invalid Workspace URL is explained, not silently refused', async ({
    page,
  }) => {
    await openCreateFromPicker(page);

    await byTestId(page, 'create-organization-dialog-name').fill('QA Org');
    await byTestId(page, 'create-organization-dialog-slug').fill('QA Org 4877!');
    await byTestId(page, 'create-organization-dialog-submit').click();

    const error = byTestId(page, 'create-organization-dialog-slug-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/lowercase letters, numbers, and hyphens only/i);
    await expect(byTestId(page, 'create-organization-dialog-slug')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // Still on the form, and nothing was created.
    await expect(page.getByTestId('create-organization-dialog-form')).toBeVisible();
    await expect(page).not.toHaveURL(/\/organization\/qa-org/);
  });

  test('organization switcher lists team org after create', async ({ page }) => {
    await registerNewUserAndGoToToday(page);
    const { slug } = await createTeamOrgAndOpenToday(page);
    await openOrganizationSwitcher(page);
    await expect(page.getByTestId(`organization-switcher-option-${slug}`)).toBeVisible({
      timeout: 10000,
    });
    await page.keyboard.press('Escape');
  });
});
