import { expect, type Page, test } from '@playwright/test';

import {
  CLINIC_ROOM_PAGES,
  CLINIC_VIEWPORTS,
  type ClinicRoom,
  expectDrawer,
  expectRoomReady,
  openFirstRow,
  openNewClinic,
  openRoomFromShell,
} from '@/tests/utils/e2e-clinic.ts';
import { byTestId } from '@/tests/utils/e2e-hybrid.ts';
import { verifyDatabaseConnection } from '@/tests/utils/e2e-session.ts';

/**
 * Dialog-route deep links (KICKOFF §4 and §8.6, `S:115`), a sample of the
 * launch's dialog routes: a direct hit — a cold load, as a shared link or a
 * refresh lands — renders the parent page and then its drawer; an id that
 * matches no record stays on the parent with one toast, "<Record> not found ·
 * it may have been deleted", and the dead URL replaced; an unknown path inside
 * the clinic goes to the member's role home with "Page not found".
 */

/**
 * A public id no record has: the entity's prefix and 21 characters (`lead_zzz…`), shaped like
 * every id the API issues, so the room reads it and the API answers 404.
 */
const unknownId = (prefix: string): string => `${prefix}_${'z'.repeat(21)}`;

/** Matches no sale in the fixture world (Medical still runs on fixtures, parked). */
const UNKNOWN_FIXTURE_ID = '00000000-0000-4000-8000-00000000dead';

/** A cold load of a path inside the clinic — the session comes back from the refresh cookie. */
async function coldLoad(page: Page, slug: string, path: string): Promise<void> {
  await page.goto(`/organization/${slug}/${path}`, { waitUntil: 'domcontentloaded' });
}

/** One toast saying `text` — the deep link's only word when its record is gone. */
async function expectToast(page: Page, text: RegExp): Promise<void> {
  await expect(page.getByTestId('app-toast').filter({ hasText: text })).toBeVisible({
    timeout: 15_000,
  });
}

/** Create routes: no record to load, so a direct hit is the page and the drawer at once. */
const CREATE_ROUTES = [
  { path: 'leads/create', page: 'leads-page', drawer: 'new-lead-drawer' },
  {
    path: 'appointments/create',
    page: 'appointments-page',
    drawer: 'new-appointment-drawer',
  },
  { path: 'patients/create', page: 'patients-page', drawer: 'patient-drawer' },
  { path: 'tasks/create', page: 'tasks-page', drawer: 'new-task-drawer' },
  { path: 'payments/receive', page: 'payments-page', drawer: 'receive-drawer' },
  { path: 'payments/day-close', page: 'payments-page', drawer: 'day-close-drawer' },
  // The invoice island has no page of its own: its drawer opens over the ledger (A-P1).
  { path: 'invoices/create', page: 'payments-page', drawer: 'invoice-drawer' },
  {
    path: 'medical/purchases/create',
    page: 'medical-purchases-page',
    drawer: 'purchase-order-drawer',
  },
  { path: 'stock/items/check', page: 'stock-items-page', drawer: 'stock-check-drawer' },
  { path: 'offerings/offers/create', page: 'offers-page', drawer: 'offer-drawer' },
  { path: 'users/branches/create', page: 'users-branches-page', drawer: 'branch-drawer' },
] as const;

/**
 * Record routes: opened from the room's list, then reloaded — the id in the URL
 * alone brings the drawer back over its room. The clinic is seeded through the
 * API (`seedClinic`), so each room has a real row; Medical's sale is a fixture's.
 */
const RECORD_ROUTES: readonly {
  room: ClinicRoom;
  rows: string;
  drawer: string;
  url: RegExp;
}[] = [
  {
    room: 'leads',
    rows: 'leads-table-row',
    drawer: 'lead-drawer',
    url: /\/leads\/[^/?]+(?:\?|$)/,
  },
  {
    room: 'medical',
    rows: 'medical-sales-table-row',
    drawer: 'sale-drawer',
    url: /\/medical\/sales\/[^/?]+(?:\?|$)/,
  },
  {
    room: 'appointments',
    rows: 'appointments-table-row',
    drawer: 'appointment-drawer',
    url: /\/appointments\/[^/?]+(?:\?|$)/,
  },
  {
    room: 'offerings',
    rows: 'offerings-table-row',
    drawer: 'offering-drawer',
    url: /\/offerings\/[^/?]+\/edit(?:\?|$)/,
  },
];

/** Unknown ids: the parent page, the toast naming the record, and the parent's URL. */
const UNKNOWN_RECORD_ROUTES = [
  {
    id: unknownId('lead'),
    path: `leads/${unknownId('lead')}`,
    room: 'leads',
    record: /^Lead not found/,
  },
  {
    id: unknownId('appt'),
    path: `appointments/${unknownId('appt')}`,
    room: 'appointments',
    record: /^Appointment not found/,
  },
  {
    id: unknownId('task'),
    path: `tasks/${unknownId('task')}`,
    room: 'tasks',
    record: /^Task not found/,
  },
  {
    id: unknownId('off'),
    path: `offerings/${unknownId('off')}/edit`,
    room: 'offerings',
    record: /^Offering not found/,
  },
  {
    id: UNKNOWN_FIXTURE_ID,
    path: `medical/sales/${UNKNOWN_FIXTURE_ID}`,
    room: 'medical',
    record: /^Sale not found/,
  },
] as const satisfies readonly {
  id: string;
  path: string;
  room: ClinicRoom;
  record: RegExp;
}[];

test.beforeEach(async () => {
  test.skip(
    !(await verifyDatabaseConnection()),
    'DATABASE_URL must reach clinozy-be Postgres (auth.mail_outbox)',
  );
});

test.describe('Clinic dialog routes — deep links', () => {
  test.use({ viewport: CLINIC_VIEWPORTS.desktop });

  test('a create route opens its drawer over its page on a direct hit', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const { slug } = await openNewClinic(page);
    for (const route of CREATE_ROUTES) {
      await test.step(route.path, async () => {
        await coldLoad(page, slug, route.path);
        await expect(page.getByTestId(route.page)).toBeVisible({ timeout: 15_000 });
        await expectDrawer(page, route.drawer);
      });
    }
  });

  test('a record route reopens its drawer after a reload', async ({ page }) => {
    test.setTimeout(180_000);
    await openNewClinic(page, { seed: true });
    for (const route of RECORD_ROUTES) {
      await test.step(route.room, async () => {
        await openRoomFromShell(page, route.room, 'desktop');
        if (route.room === 'leads') await byTestId(page, 'leads-tab-all').click();
        await openFirstRow(page.getByTestId(route.rows));
        await expectDrawer(page, route.drawer);
        await expect(page).toHaveURL(route.url);
        const recordUrl = page.url();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(recordUrl);
        await expectDrawer(page, route.drawer);
        // The room is behind it, and closing the drawer leaves the room.
        await expect(
          page.getByTestId(CLINIC_ROOM_PAGES[route.room].testId),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId(route.drawer)).toHaveCount(0);
        await expectRoomReady(page, route.room);
      });
    }
  });

  test('an unknown record id stays on its page and says the record is gone', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const { slug } = await openNewClinic(page);
    for (const route of UNKNOWN_RECORD_ROUTES) {
      await test.step(route.path, async () => {
        await coldLoad(page, slug, route.path);
        await expectToast(page, route.record);
        await expectRoomReady(page, route.room);
        await expect(page).not.toHaveURL(new RegExp(route.id));
        await expect(page.getByRole('dialog')).toHaveCount(0);
      });
    }
  });

  test('an unknown path inside the clinic goes to the role home with "Page not found"', async ({
    page,
  }) => {
    const { slug } = await openNewClinic(page);
    await coldLoad(page, slug, 'no-such-room/at-all');
    await expectToast(page, /^Page not found$/);
    await expectRoomReady(page, 'today');
  });
});
