import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import { letClinicSetupOpen } from '@/tests/utils/e2e-clinic-setup.ts';
import { byTestId, clickTestId, fillTestId } from '@/tests/utils/e2e-hybrid.ts';

/**
 * The clinic setup (feat-clinic-setup KICKOFF §8; BRIEF.md:251–281), against the live clinozy-be:
 * a new clinic's first landing opens the drawer at step 1 by itself; three steps in order; "Go
 * live" creates the Consultation and takes the clinic live; the avatar's ring and "Finish setup"
 * then lead to the guide. Run at a desktop and a phone width, with an accessibility scan of each step.
 */

/** No critical or serious accessibility finding in the open drawer (`testId` is its root). */
async function expectAccessible(page: Page, testId: string) {
  // Let the drawer's entrance settle before scanning.
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .include(`[data-testid="${testId}"]`)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations
    .filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target).join(' | ')}`,
    );
  expect(serious).toEqual([]);
}

/** Waits for the setup drawer to stand at `step` (its open card and its address). */
async function expectStep(page: Page, step: 'clinic-type' | 'location' | 'you') {
  await expect(page).toHaveURL(new RegExp(`#setup/${step}$`), { timeout: 15000 });
  await expect(byTestId(page, `setup-drawer-step-${step}`)).toHaveAttribute(
    'data-status',
    'open',
  );
}

/** Walks the three steps and goes live. */
async function walkTheSetup(page: Page) {
  await expectStep(page, 'clinic-type');
  await expect(byTestId(page, 'setup-drawer-title')).toContainText('Set up');
  // A new clinic starts as a skin clinic (the organization's default); "Next" confirms it.
  await expect(byTestId(page, 'setup-specialty-skin')).toBeVisible();
  await expectAccessible(page, 'setup-drawer');
  await clickTestId(page, 'setup-drawer-save');

  await expectStep(page, 'location');
  await fillTestId(page, 'setup-location-pin', '395007');
  // The PIN fills the city and state from the bundled directory; every field stays editable.
  await expect(byTestId(page, 'setup-location-city')).toHaveValue('Surat', {
    timeout: 10000,
  });
  await expect(byTestId(page, 'setup-location-state')).toHaveValue('Gujarat');
  if ((await byTestId(page, 'setup-location-area').inputValue()) === '') {
    await fillTestId(page, 'setup-location-area', 'Vesu');
  }
  await fillTestId(page, 'setup-location-addressLine', '12 Ring Road');
  await fillTestId(page, 'setup-location-phone', '9876543210');
  await expect(byTestId(page, 'setup-location-name')).not.toHaveValue('');
  await expectAccessible(page, 'setup-drawer');
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/app/branches') &&
      response.request().method() === 'POST',
  );
  await clickTestId(page, 'setup-drawer-save');
  // The clinic's first branch is its main branch (clinozy-be RC-4).
  const branch = (await (await created).json()) as { data: { is_main: boolean } };
  expect(branch.data.is_main).toBe(true);

  await expectStep(page, 'you');
  await clickTestId(page, 'setup-you-doctor');
  await expectAccessible(page, 'setup-drawer');
  await clickTestId(page, 'setup-drawer-save');

  await expect(page).toHaveURL(/#setup\/live$/, { timeout: 30000 });
  await expect(byTestId(page, 'setup-live-summary')).toContainText('Consultation');
  await expect(byTestId(page, 'setup-live-summary')).toContainText('you as doctor');
  await expectAccessible(page, 'setup-live');
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 375, height: 812 },
]) {
  test.describe(`Clinic setup — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('a new clinic sets up in three steps, goes live, and finds the guide behind its avatar', async ({
      page,
    }) => {
      letClinicSetupOpen(page);
      await registerNewUserAndGoToToday(page);
      await walkTheSetup(page);

      await clickTestId(page, 'setup-live-done');
      await expect(page).not.toHaveURL(/#setup/);
      await expect(page.getByTestId('today-page')).toBeVisible();

      // The ring stays while the guide is unfinished; "Finish setup" opens the guide.
      await expect(byTestId(page, 'user-menu-setup-ring')).toBeVisible();
      await clickTestId(page, 'user-menu-trigger');
      await clickTestId(page, 'account-menu-finish-setup');
      await expect(page).toHaveURL(/#setup\/guide$/);
      await expect(byTestId(page, 'setup-guide-item-first_appointment')).toBeVisible();
      await expectAccessible(page, 'setup-guide');

      // "Invite your team" is skipped; the first appointment cannot be.
      await clickTestId(page, 'setup-guide-item-invite_team-skip');
      await expect(byTestId(page, 'setup-guide-item-invite_team')).toHaveAttribute(
        'data-state',
        'skipped',
      );
      await expect(byTestId(page, 'setup-guide-item-first_appointment-skip')).toHaveCount(
        0,
      );
    });

    test('closing the drawer is "Explore first": it never opens by itself again', async ({
      page,
    }) => {
      letClinicSetupOpen(page);
      await registerNewUserAndGoToToday(page);
      await expectStep(page, 'clinic-type');
      // Closing stores the deferral on the server (D5) — the drawer never opens by itself again.
      const deferred = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/app/onboarding-setup') &&
          response.request().method() === 'PATCH',
      );
      await clickTestId(page, 'setup-drawer-dismiss');
      const answer = (await (await deferred).json()) as {
        data: { deferred_at: string | null };
      };
      expect(answer.data.deferred_at).not.toBeNull();
      await expect(page).not.toHaveURL(/#setup/);
      await expect(page.getByTestId('today-page')).toBeVisible();

      // "Finish setup" still reopens it at the first unanswered step.
      await clickTestId(page, 'user-menu-trigger');
      await clickTestId(page, 'account-menu-finish-setup');
      await expectStep(page, 'clinic-type');
    });
  });
}
