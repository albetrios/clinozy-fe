import { expect, type Page, test } from '@playwright/test';

import {
  APP_VIEWPORTS,
  type AppRoom,
  expectDrawer,
  expectRoomReady,
  openNewClinic,
  openRoomFromShell,
} from '@/tests/utils/e2e-app.ts';
import { byTestId } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Write flows (#78): each room's create drawer saves a real record on clinozy-be, the room
 * lists it, and a full reload — a cold read of the live API, nothing from the cache — still
 * lists it. The smoke (`app-rooms.e2e.test.ts`) only opens and closes the drawers.
 *
 * Desktop only: the writes are the same at every width, and the phone layout is the smoke's.
 * Each test opens its own brand-new clinic, so the names it writes are its own.
 */

/** A name no other run has written. */
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

/** The room's drawer saved and closed, and `name` listed in the room — then again after a reload. */
async function expectListedAfterReload(
  page: Page,
  room: AppRoom,
  name: string,
): Promise<void> {
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.reload();
  await expectRoomReady(page, room);
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.beforeEach(async () => {
  test.skip(
    !(await verifyDatabaseConnection()),
    'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
  );
});

test.describe('Clinic rooms write through to clinozy-be', () => {
  test.use({ viewport: APP_VIEWPORTS.desktop });

  test('offerings: a new offering is saved and listed', async ({ page }) => {
    await openNewClinic(page);
    await openRoomFromShell(page, 'offerings', 'desktop');
    const name = uniqueName('Hydra facial');
    await byTestId(page, 'offerings-new-button').click();
    await expectDrawer(page, 'offering-drawer');
    await page.getByTestId('offering-drawer-name').fill(name);
    await page.getByTestId('offering-drawer-price').fill('1500');
    await page.getByTestId('offering-drawer-save').click();
    await expect(page.getByTestId('offering-drawer')).toHaveCount(0, { timeout: 15_000 });
    await expectListedAfterReload(page, 'offerings', name);
  });

  test('stock: a new item is saved and listed', async ({ page }) => {
    await openNewClinic(page);
    await openRoomFromShell(page, 'stock', 'desktop');
    const name = uniqueName('Gauze');
    await byTestId(page, 'stock-items-new').click();
    await expectDrawer(page, 'stock-item-drawer');
    await page.getByTestId('stock-item-drawer-name').fill(name);
    await page.getByTestId('stock-item-drawer-save').click();
    await expect(page.getByTestId('stock-item-drawer')).toHaveCount(0, {
      timeout: 15_000,
    });
    await expectListedAfterReload(page, 'stock', name);
  });

  test('tasks: a task about no one is saved and listed', async ({ page }) => {
    await openNewClinic(page);
    await openRoomFromShell(page, 'tasks', 'desktop');
    const title = uniqueName('Order more gloves');
    await byTestId(page, 'tasks-new').click();
    await expectDrawer(page, 'new-task-drawer');
    await page.getByTestId('new-task-title').fill(title);
    await page.getByTestId('new-task-drawer-save').click();
    await expect(page.getByTestId('new-task-drawer')).toHaveCount(0, { timeout: 15_000 });
    await expectListedAfterReload(page, 'tasks', title);
  });

  test(
    'patients: a new patient is saved and listed',
    { tag: '@smoke' },
    async ({ page }) => {
      // A patient needs a branch to call home: the seeded clinic has one.
      await openNewClinic(page, { seed: true });
      await openRoomFromShell(page, 'patients', 'desktop');
      const first = uniqueName('Priya').replace(' ', '');
      await byTestId(page, 'patients-new').click();
      await expectDrawer(page, 'patient-drawer');
      await page.getByTestId('patient-drawer-first-name').fill(first);
      // Ten digits, unique per run so the duplicate-number check finds no one.
      const mobile = `9${Date.now().toString().slice(-9)}`;
      await page.getByTestId('patient-drawer-mobile').fill(mobile);
      await page.getByTestId('patient-drawer-save').click();
      await expect(page.getByTestId('patient-drawer')).toHaveCount(0, {
        timeout: 15_000,
      });
      // The new file may open over the room; the room lists her either way.
      await page.goto(page.url().replace(/\/patients\/.*$/, '/patients'));
      await expectRoomReady(page, 'patients');
      await expectListedAfterReload(page, 'patients', first);
    },
  );
  test('leads: a lead for a new contact is saved and listed', async ({ page }) => {
    await openNewClinic(page, { seed: true });
    await openRoomFromShell(page, 'leads', 'desktop');
    const first = uniqueName('Meera').replace(' ', '');
    await byTestId(page, 'leads-new-lead').click();
    await expectDrawer(page, 'new-lead-drawer');
    // The contact picker's quick add: the name from the search, the mobile beside it.
    await page.getByTestId('new-lead-search').fill(`${first} Joshi`);
    await page.getByTestId('new-lead-new-contact').click();
    const quickAdd = page.getByTestId('new-lead-contact-quick-add');
    await expect(quickAdd.getByTestId('new-lead-contact-quick-add-name')).toHaveValue(
      `${first} Joshi`,
    );
    await quickAdd
      .getByTestId('new-lead-contact-quick-add-mobile')
      .fill(`9${Date.now().toString().slice(-9)}`);
    await quickAdd.getByTestId('new-lead-contact-quick-add-submit').click();
    await expect(quickAdd).toHaveCount(0);
    await page
      .getByTestId('new-lead-drawer')
      .getByRole('button', { name: 'Google' })
      .click();
    await page.getByTestId('new-lead-drawer-save').click();
    await expect(page.getByTestId('new-lead-drawer')).toHaveCount(0, { timeout: 15_000 });
    await byTestId(page, 'leads-tab-all').click();
    await expect(page.getByText(first).first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expectRoomReady(page, 'leads');
    await byTestId(page, 'leads-tab-all').click();
    await expect(page.getByText(first).first()).toBeVisible({ timeout: 15_000 });
  });

  test('payments: an advance received from a patient is saved and in the ledger', async ({
    page,
  }) => {
    const { seed } = await openNewClinic(page, { seed: true });
    await openRoomFromShell(page, 'payments', 'desktop');
    await byTestId(page, 'payments-receive').click();
    await expectDrawer(page, 'receive-drawer');
    await page.getByTestId('receive-drawer-patient').click();
    await page.getByTestId('receive-drawer-patient-search').fill('Asha');
    await page
      .getByTestId(`receive-drawer-patient-option-${seed?.patientId ?? ''}`)
      .click();
    const amount = page.getByTestId('receive-drawer-splits-amount');
    await amount.fill('');
    await amount.fill('500');
    await page.getByTestId('receive-drawer-save').click();
    await expect(page.getByTestId('receive-drawer')).toHaveCount(0, { timeout: 15_000 });
    await expectListedAfterReload(page, 'payments', 'Asha Patel');
  });

  test('appointments: a booking for a patient is saved and listed', async ({ page }) => {
    await openNewClinic(page, { seed: true });
    await openRoomFromShell(page, 'appointments', 'desktop');
    await byTestId(page, 'appointments-new-appointment').click();
    await expectDrawer(page, 'new-appointment-drawer');
    const form = page.getByTestId('new-appointment-drawer');
    await form.getByTestId('appointment-form-who-search').fill('Asha');
    await form.getByTestId('appointment-form-who-hit').first().click();
    await expect(form.getByTestId('appointment-form-who-card')).toContainText('Asha');
    const slots = form.getByTestId('appointment-form-slot-time');
    const hasFreeStart = await slots
      .first()
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasFreeStart, 'no free start is left today in the clinic’s time zone');
    await slots.last().click();
    await page.getByTestId('new-appointment-drawer-save').click();
    await expect(page.getByTestId('new-appointment-drawer')).toHaveCount(0, {
      timeout: 15_000,
    });
    // The seeded booking is Asha's too: two of hers are listed after the write.
    await page.reload();
    await expectRoomReady(page, 'appointments');
    await expect(page.getByText('Asha Patel')).toHaveCount(2, { timeout: 15_000 });
  });
  test('today: a check-in moves the booking out of Arriving, and stays moved', async ({
    page,
  }) => {
    const { seed } = await openNewClinic(page, { seed: true });
    test.skip(
      !seed?.appointmentId,
      'no bookable slot is left today in the clinic’s time zone',
    );
    const arriving = async () => {
      await byTestId(page, 'today-lane-arriving').click();
      const panel = page.getByTestId('today-panel');
      await expect(panel).toHaveAttribute('data-lane', 'arriving');
      return panel.getByTestId('today-card');
    };
    const cards = await arriving();
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const before = await cards.count();
    const checkIn = page
      .getByTestId('today-panel')
      .getByTestId('today-card-action')
      .first();
    await expect(checkIn).toHaveAttribute('data-action', 'checkIn');
    await checkIn.click();
    await expect(cards).toHaveCount(before - 1);
    await page.reload();
    await expectRoomReady(page, 'today');
    await expect(await arriving()).toHaveCount(before - 1, { timeout: 15_000 });
  });
});
