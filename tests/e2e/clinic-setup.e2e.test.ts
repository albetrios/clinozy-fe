import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import { letClinicSetupOpen } from '@/tests/utils/e2e-clinic-setup.ts';
import { byTestId, clickTestId, fillTestId } from '@/tests/utils/e2e-hybrid.ts';

/**
 * The clinic setup (feat-clinic-setup KICKOFF §8; change-setup-one-question KICKOFF §8), against
 * the live clinozy-be: a new clinic's first landing opens the drawer at its first question by
 * itself; five questions, one per screen — the clinic type, the PIN (which moves on by itself), the
 * street address, the phone (which creates the main branch), and whether the owner sees patients (a
 * tap goes live, creating the Consultation); the avatar's ring and "Finish setup" then lead to the
 * guide. Run at a desktop and a phone width, with an accessibility scan of each question.
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

/** The drawer's questions, by the step whose address holds them. */
const QUESTION_STEP = {
  'clinic-type': 'clinic-type',
  pin: 'location',
  address: 'location',
  phone: 'location',
  you: 'you',
} as const;

/** Waits for the setup drawer to show `question` alone, at its step's address. */
async function expectQuestion(page: Page, question: keyof typeof QUESTION_STEP) {
  await expect(page).toHaveURL(new RegExp(`#setup/${QUESTION_STEP[question]}$`), {
    timeout: 15000,
  });
  await expect(byTestId(page, `setup-question-${question}`)).toBeVisible();
}

/** Answers the five questions; the last one's tap goes live. */
async function walkTheSetup(page: Page) {
  await expectQuestion(page, 'clinic-type');
  await expect(byTestId(page, 'setup-drawer-title')).toContainText('Set up');
  await expect(byTestId(page, 'setup-drawer')).toContainText('Question 1 of 5');
  // A new clinic starts as a skin clinic (the organization's default); "Next" confirms it.
  await expect(byTestId(page, 'setup-specialty-skin')).toBeVisible();
  await expectAccessible(page, 'setup-drawer');
  await clickTestId(page, 'setup-drawer-save');

  // The PIN's sixth digit fills the place from the bundled directory and moves on by itself.
  await expectQuestion(page, 'pin');
  await expectAccessible(page, 'setup-drawer');
  await fillTestId(page, 'setup-question-pin-input', '395007');
  await expectQuestion(page, 'address');
  await expect(byTestId(page, 'setup-question-address-place')).toContainText('Surat', {
    timeout: 10000,
  });
  await expect(byTestId(page, 'setup-question-address-place')).toContainText('Gujarat');
  // 395007 covers several areas: one is picked from its chips.
  await clickTestId(page, 'setup-location-area-pick-Vesu');
  await fillTestId(page, 'setup-question-address-input', '12 Ring Road');
  await expectAccessible(page, 'setup-drawer');
  // Back keeps every answer: the PIN is still there, and so is the address after Next.
  await clickTestId(page, 'setup-drawer-back');
  await expectQuestion(page, 'pin');
  await expect(byTestId(page, 'setup-question-pin-input')).toHaveValue('395007');
  await clickTestId(page, 'setup-drawer-save');
  await expectQuestion(page, 'address');
  await expect(byTestId(page, 'setup-question-address-input')).toHaveValue(
    '12 Ring Road',
  );
  await clickTestId(page, 'setup-drawer-save');

  await expectQuestion(page, 'phone');
  await fillTestId(page, 'setup-question-phone-input', '9876543210');
  await expectAccessible(page, 'setup-drawer');
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/app/branches') &&
      response.request().method() === 'POST',
  );
  await clickTestId(page, 'setup-drawer-save');
  // The clinic's first branch is its main branch (clinozy-be RC-4), named after the clinic.
  const branch = (await (await created).json()) as {
    data: { is_main: boolean; name: string; opens_at: string; closes_at: string };
  };
  expect(branch.data.is_main).toBe(true);
  await expect(byTestId(page, 'setup-drawer-title')).toContainText(branch.data.name);
  expect([branch.data.opens_at, branch.data.closes_at]).toEqual(['10:00', '20:00']);

  // A tap on the answer goes live.
  await expectQuestion(page, 'you');
  await expect(byTestId(page, 'setup-drawer')).toContainText('Question 5 of 5');
  await expectAccessible(page, 'setup-drawer');
  await clickTestId(page, 'setup-you-doctor');

  await expect(page).toHaveURL(/#setup\/live$/, { timeout: 30000 });
  await expect(byTestId(page, 'setup-live-summary')).toContainText('Consultation');
  await expect(byTestId(page, 'setup-live-summary')).toContainText('you as doctor');
  await expect(byTestId(page, 'setup-live-branch')).toContainText('10:00–20:00');
  await expect(byTestId(page, 'setup-live-branch-change')).toBeVisible();
  await expectAccessible(page, 'setup-live');
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 375, height: 812 },
]) {
  test.describe(`Clinic setup — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('a new clinic sets up in five questions, goes live, and finds the guide behind its avatar', async ({
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
      await expectQuestion(page, 'clinic-type');
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

      // "Finish setup" still reopens it at the first unanswered question.
      await clickTestId(page, 'user-menu-trigger');
      await clickTestId(page, 'account-menu-finish-setup');
      await expectQuestion(page, 'clinic-type');
    });
  });
}
