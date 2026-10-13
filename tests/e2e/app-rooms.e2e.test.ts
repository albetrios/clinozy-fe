import { expect, type Page, test } from '@playwright/test';

import {
  APP_ROOMS,
  APP_VIEWPORTS,
  type AppRoom,
  type AppTier,
  expectDrawer,
  expectRoomReady,
  openFirstRow,
  openNewClinic,
  openRoomFromShell,
} from '@/tests/utils/e2e-app.ts';
import { byTestId } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Launch smoke (KICKOFF §8.6, L-55): every clinic room, at desktop and at the
 * phone viewport, opened from the shell the way a member opens it and walked
 * through one happy path — on a brand-new clinic whose owner lands on Today.
 *
 * The rooms read the live clinozy-be, so each new clinic is seeded through the API before its
 * owner walks in (`seedClinic`: a branch open all week, an offering, a patient, a lead, a task
 * and a booking later today). Medical alone still runs on the fixture world (parked).
 */

/**
 * Opens a record drawer from `trigger` and closes it again: the dialog route
 * is in the URL while it is open, and closing it returns to the room's URL
 * with the room still behind it.
 */
async function openAndCloseDrawer(
  page: Page,
  room: AppRoom,
  drawer: { open: () => Promise<void>; testId: string; url: RegExp; close?: 'escape' },
): Promise<void> {
  const roomUrl = page.url();
  await drawer.open();
  await expectDrawer(page, drawer.testId);
  await expect(page).toHaveURL(drawer.url);

  if (drawer.close === 'escape') {
    await page.keyboard.press('Escape');
  } else {
    await byTestId(page, `${drawer.testId}-close`).click();
  }
  await expect(page.getByTestId(drawer.testId)).toHaveCount(0);
  await expect(page).toHaveURL(roomUrl);
  await expectRoomReady(page, room);
}

/** One happy path per room, run where the room has just opened. */
const HAPPY_PATHS: Record<AppRoom, (page: Page) => Promise<void>> = {
  // Check in someone arriving: the card leaves the lane, with Undo (D32).
  today: async (page) => {
    await byTestId(page, 'today-lane-arriving').click();
    const panel = page.getByTestId('today-panel');
    await expect(panel).toHaveAttribute('data-lane', 'arriving');
    await expect(byTestId(page, 'today-lane-arriving')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const cards = panel.getByTestId('today-card');
    const arriving = await cards.count();
    expect(arriving).toBeGreaterThan(0);
    const checkIn = panel.getByTestId('today-card-action').first();
    await expect(checkIn).toHaveAttribute('data-action', 'checkIn');
    await checkIn.click();
    await expect(cards).toHaveCount(arriving - 1);
    await expect(page.getByTestId('toast-action')).toHaveText(/undo/i);
  },

  // Open a lead from the list: the lead drawer is its dialog route.
  leads: async (page) => {
    await byTestId(page, 'leads-tab-all').click();
    await openAndCloseDrawer(page, 'leads', {
      open: () => openFirstRow(page.getByTestId('leads-table-row')),
      testId: 'lead-drawer',
      url: /\/leads\/[^/?]+(?:\?|$)/,
      close: 'escape',
    });
  },

  // New appointment: the shared appointment form over the room.
  appointments: async (page) => {
    await openAndCloseDrawer(page, 'appointments', {
      open: () => byTestId(page, 'appointments-new-appointment').click(),
      testId: 'new-appointment-drawer',
      url: /\/appointments\/create(?:\?|$)/,
    });
  },

  // Open a patient: the patient file, and back to the list.
  patients: async (page) => {
    await openFirstRow(page.getByTestId('patients-table-row'));
    await expect(page).toHaveURL(/\/patients\/[^/?]+\/timeline(?:\?|$)/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId('patient-file-layout')).toBeVisible({
      timeout: 15_000,
    });
    await byTestId(page, 'patient-file-back').click();
    await expectRoomReady(page, 'patients');
  },

  // Open a sale: the read-only sale drawer over Sales.
  medical: async (page) => {
    await openAndCloseDrawer(page, 'medical', {
      open: () => openFirstRow(page.getByTestId('medical-sales-table-row')),
      testId: 'sale-drawer',
      url: /\/medical\/sales\/[^/?]+(?:\?|$)/,
    });
  },

  // New item: the item drawer over Items.
  stock: async (page) => {
    await openAndCloseDrawer(page, 'stock', {
      open: () => byTestId(page, 'stock-items-new').click(),
      testId: 'stock-item-drawer',
      url: /\/stock\/items\/create(?:\?|$)/,
    });
  },

  // Receive a payment: the Receive drawer over the ledger.
  payments: async (page) => {
    await openAndCloseDrawer(page, 'payments', {
      open: () => byTestId(page, 'payments-receive').click(),
      testId: 'receive-drawer',
      url: /\/payments\/receive(?:\?|$)/,
    });
  },

  // Open a task from the queue: the task drawer.
  tasks: async (page) => {
    await openAndCloseDrawer(page, 'tasks', {
      open: () => openFirstRow(page.getByTestId('tasks-row')),
      testId: 'task-drawer',
      url: /\/tasks\/[^/?]+(?:\?|$)/,
    });
  },

  // Open an offering: the offering drawer.
  offerings: async (page) => {
    await openAndCloseDrawer(page, 'offerings', {
      open: () => openFirstRow(page.getByTestId('offerings-table-row')),
      testId: 'offering-drawer',
      url: /\/offerings\/[^/?]+\/edit(?:\?|$)/,
    });
  },

  // Open the owner's own row: the member drawer.
  users: async (page) => {
    await openAndCloseDrawer(page, 'users', {
      open: () => openFirstRow(page.getByTestId('users-team-table-row')),
      testId: 'user-drawer',
      url: /\/users\/[^/?]+\/edit(?:\?|$)/,
    });
  },
};

test.beforeEach(async () => {
  test.skip(
    !(await verifyDatabaseConnection()),
    'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
  );
});

for (const tier of Object.keys(APP_VIEWPORTS) as AppTier[]) {
  test.describe(`Clinic rooms @ ${tier}`, () => {
    test.use({ viewport: APP_VIEWPORTS[tier] });

    for (const room of APP_ROOMS) {
      test(`${room} opens from the shell and its happy path works`, async ({ page }) => {
        const { seed } = await openNewClinic(page, { seed: true });
        test.skip(
          room === 'today' && !seed?.appointmentId,
          'no bookable slot is left today in the clinic’s time zone',
        );
        // Today is where an owner lands (D25); every other room opens from the shell.
        if (room !== 'today') await openRoomFromShell(page, room, tier);
        await HAPPY_PATHS[room](page);
      });
    }
  });
}
