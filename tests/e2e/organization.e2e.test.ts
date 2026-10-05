import { expect, type Page, test } from '@playwright/test';

import {
  createTeamOrgAndOpenDashboard,
  openOrganizationSwitcher,
  registerNewUserAndGoToDashboard,
} from '@/tests/utils/e2e-auth.ts';
import { byTestId, gotoApp, navigateAuthenticated } from '@/tests/utils/e2e-hybrid.ts';

/**
 * The header switcher with "Create organization" belongs to the preview shells
 * (sidebar, top nav, rail). The clinic shell — the section bar, the default — keeps
 * the switcher in the Account menu as "Switch clinic", which lists workspaces and
 * creates none, so the create-dialog specs skip there.
 */
const NO_HEADER_SWITCHER =
  'the section-bar shell has no header switcher (Switch clinic lives in the Account menu and creates nothing)';

/** The header switcher of a preview shell, when this shell has one. */
async function headerSwitcher(page: Page) {
  const trigger = byTestId(page, 'organization-switcher-trigger');
  return (await trigger.isVisible()) ? trigger : null;
}

test.describe('Organization picker', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await gotoApp(page, '/organization');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('redirects provisioned personal users to dashboard', async ({ page }) => {
    await registerNewUserAndGoToDashboard(page);
    await navigateAuthenticated(page, '/organization');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });

  test('the switcher opens an accessible menu and closes on Escape', async ({ page }) => {
    await registerNewUserAndGoToDashboard(page);
    const { slug } = await createTeamOrgAndOpenDashboard(page);
    await openOrganizationSwitcher(page);

    const option = page.getByTestId(`organization-switcher-option-${slug}`);
    await expect(option).toBeVisible({ timeout: 10000 });
    // a11y guard: a workspace is a menu item of the switcher's own menu.
    await expect(page.getByRole('menuitem', { name: new RegExp(slug) })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(option).toBeHidden();
  });

  test('the create-organization action opens the create dialog', async ({ page }) => {
    await registerNewUserAndGoToDashboard(page);
    const trigger = await headerSwitcher(page);
    test.skip(trigger === null, NO_HEADER_SWITCHER);
    await trigger?.click();
    const createItem = page.getByTestId('organization-switcher-create');
    test.skip(
      !(await createItem.isVisible()),
      'team creation disabled in this deployment mode',
    );

    await createItem.click();
    await expect(page.getByTestId('create-organization-dialog-form')).toBeVisible();
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
    await registerNewUserAndGoToDashboard(page);
    const trigger = await headerSwitcher(page);
    test.skip(trigger === null, NO_HEADER_SWITCHER);
    await trigger?.click();
    const createItem = page.getByTestId('organization-switcher-create');
    test.skip(
      !(await createItem.isVisible()),
      'team creation disabled in this deployment mode',
    );
    await createItem.click();
    await expect(page.getByTestId('create-organization-dialog-form')).toBeVisible();

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
    await registerNewUserAndGoToDashboard(page);
    const { slug } = await createTeamOrgAndOpenDashboard(page);
    await openOrganizationSwitcher(page);
    await expect(page.getByTestId(`organization-switcher-option-${slug}`)).toBeVisible({
      timeout: 10000,
    });
    await page.keyboard.press('Escape');
  });
});
