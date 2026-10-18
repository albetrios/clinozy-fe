import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import {
  APP_ROOMS,
  APP_VIEWPORTS,
  type AppRoom,
  expectDrawer,
  expectRoomLoaded,
  openFirstRow,
  openNewClinic,
  openRoomFromShell,
} from '@/tests/utils/e2e-app.ts';
import { navigateInApp, registerNewUserAndGoToToday } from '@/tests/utils/e2e-auth.ts';
import {
  byTestId,
  clickTestId,
  DARK_HTML_CLASS,
  expectAuthScreenReady,
  expectHybridVisible,
  gotoApp,
  openSettingsHash,
  seedDarkMode,
} from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function settleAnimations(page: Page) {
  await page.waitForTimeout(400);
}

test.describe('Accessibility', () => {
  test(
    'login page has no critical a11y violations',
    { tag: '@smoke' },
    async ({ page }) => {
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
    },
  );

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

  test(
    'Today — the clinic home — has no critical a11y violations',
    { tag: '@smoke' },
    async ({ page }) => {
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
    },
  );

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

  test(
    'accept-invite error state has no critical a11y violations',
    { tag: '@smoke' },
    async ({ page }) => {
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
    },
  );

  test(
    'settings modal (account profile) has no critical a11y violations',
    { tag: '@smoke' },
    async ({ page }) => {
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
    },
  );
});

/**
 * The serious and critical WCAG 2.1 AA violations on the page, or only inside `scope` —
 * each named by its rule and the elements it found, so a failure reads as the to-do list.
 * Select triggers are left out, as in the scans above.
 */
async function seriousViolations(page: Page, scope?: string) {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-slot="select-trigger"]');
  if (scope) builder = builder.include(scope);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      rule: v.id,
      elements: v.nodes.map(
        (node) => `${node.target.join(' ')} — ${node.html.slice(0, 160)}`,
      ),
    }));
}

/** Each room's main drawer: how it opens from the room, and its test id. */
const ROOM_DRAWERS: Record<
  Exclude<AppRoom, 'today'>,
  { open: (page: Page) => Promise<void>; testId: string }
> = {
  leads: {
    open: (page) => byTestId(page, 'leads-new-lead').click(),
    testId: 'new-lead-drawer',
  },
  appointments: {
    open: (page) => byTestId(page, 'appointments-new-appointment').click(),
    testId: 'new-appointment-drawer',
  },
  patients: {
    open: (page) => byTestId(page, 'patients-new').click(),
    testId: 'patient-drawer',
  },
  medical: {
    open: (page) => openFirstRow(page.getByTestId('medical-sales-table-row')),
    testId: 'sale-drawer',
  },
  stock: {
    open: (page) => byTestId(page, 'stock-items-new').click(),
    testId: 'stock-item-drawer',
  },
  payments: {
    open: (page) => byTestId(page, 'payments-receive').click(),
    testId: 'receive-drawer',
  },
  tasks: {
    open: (page) => byTestId(page, 'tasks-new').click(),
    testId: 'new-task-drawer',
  },
  offerings: {
    open: (page) => byTestId(page, 'offerings-new-button').click(),
    testId: 'offering-drawer',
  },
  users: {
    open: (page) => openFirstRow(page.getByTestId('users-team-table-row')),
    testId: 'user-drawer',
  },
  branches: {
    open: (page) => byTestId(page, 'branches-new-branch').click(),
    testId: 'branch-drawer',
  },
};

// Every room of a seeded clinic, the way its owner meets it — rows, not empty states — and
// its main drawer, scoped to the dialog (the dimmed room behind it is not what is certified);
// in light and in dark, the two schemes a member can choose.
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Accessibility — clinic rooms (${scheme})`, () => {
    test.use({ viewport: APP_VIEWPORTS.desktop });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !(await verifyDatabaseConnection()),
        'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
      );
      if (scheme === 'dark') await seedDarkMode(page);
    });

    /** A new seeded clinic, its owner on Today, in this scheme. */
    async function openSeededClinic(page: Page): Promise<void> {
      await openNewClinic(page, { seed: true });
      if (scheme === 'dark')
        await expect(page.locator('html')).toHaveClass(DARK_HTML_CLASS);
    }

    test('Today with the seeded floor has no critical a11y violations', async ({
      page,
    }) => {
      await openSeededClinic(page);
      await expect(page.getByTestId('today-page')).not.toHaveAttribute('aria-busy', {
        timeout: 15_000,
      });
      await settleAnimations(page);
      expect(await seriousViolations(page)).toEqual([]);
    });

    test(
      'the patient file (timeline) has no critical a11y violations',
      { tag: '@smoke' },
      async ({ page }) => {
        await openSeededClinic(page);
        await openRoomFromShell(page, 'patients', 'desktop');
        await expectRoomLoaded(page, 'patients');
        await openFirstRow(page.getByTestId('patients-table-row'));
        const file = page.getByTestId('patient-file-layout');
        await expect(file).toBeVisible({ timeout: 15_000 });
        await expect(file.locator('[data-slot="skeleton"]')).toHaveCount(0, {
          timeout: 15_000,
        });
        await settleAnimations(page);
        expect(await seriousViolations(page)).toEqual([]);
      },
    );

    for (const room of APP_ROOMS.filter((name) => name !== 'today')) {
      const drawer = ROOM_DRAWERS[room];
      test(`${room}: the room and its ${drawer.testId} have no critical a11y violations`, async ({
        page,
      }) => {
        await openSeededClinic(page);
        await openRoomFromShell(page, room, 'desktop');
        await expectRoomLoaded(page, room);
        await settleAnimations(page);
        expect(await seriousViolations(page), `${room} room`).toEqual([]);

        await drawer.open(page);
        await expectDrawer(page, drawer.testId);
        await settleAnimations(page);
        expect(
          await seriousViolations(page, `[data-testid="${drawer.testId}"]`),
          drawer.testId,
        ).toEqual([]);
      });
    }
  });
}
