import { expect, type Locator, type Page, test } from '@playwright/test';

import { establishSessionInPage, navigateInApp } from '@/tests/utils/e2e-auth.ts';
import { probeLiveDeployment } from '@/tests/utils/e2e-deployment-mode.ts';
import { byTestId, expectLoginFormReady, gotoApp } from '@/tests/utils/e2e-hybrid.ts';
import { createSessionViaEmailCode } from '@/tests/utils/e2e-session.ts';
import { createTeamOrganization } from '@/tests/utils/e2e-tenancy.ts';

/** The clinic rooms (KICKOFF §4) by their nav id, in nav order. */
export const CLINIC_ROOMS = [
  'today',
  'leads',
  'appointments',
  'patients',
  'medical',
  'stock',
  'payments',
  'tasks',
  'offerings',
  'users',
] as const;

/** A clinic room's nav id (`nav-<room>`, `all-sections-<room>`). */
export type ClinicRoom = (typeof CLINIC_ROOMS)[number];

/**
 * Where a room lands and how it names itself: the path under the organization
 * (`/medical` and `/stock` open on their first tab), the page root's test id,
 * and its one `h1`.
 */
export const CLINIC_ROOM_PAGES: Record<
  ClinicRoom,
  { path: string; testId: string; heading: RegExp }
> = {
  today: {
    path: 'today',
    testId: 'today-page',
    heading: /^Good (morning|afternoon|evening)/,
  },
  leads: { path: 'leads', testId: 'leads-page', heading: /^Leads$/ },
  appointments: {
    path: 'appointments',
    testId: 'appointments-page',
    heading: /^Appointments$/,
  },
  patients: { path: 'patients', testId: 'patients-page', heading: /^Patients$/ },
  medical: { path: 'medical/sales', testId: 'medical-sales-page', heading: /^Medical$/ },
  stock: { path: 'stock/items', testId: 'stock-items-page', heading: /^Clinic stock$/ },
  payments: { path: 'payments', testId: 'payments-page', heading: /^Payments$/ },
  tasks: { path: 'tasks', testId: 'tasks-page', heading: /^Tasks$/ },
  offerings: { path: 'offerings', testId: 'offerings-page', heading: /^Offerings$/ },
  users: { path: 'users', testId: 'users-page', heading: /^Users$/ },
};

/**
 * The rooms a new member has pinned (`preferences-api.ts`): the header's tabs
 * from `md`, the phone's tab bar. Every other room opens from All sections.
 */
const PINNED_BY_DEFAULT: readonly ClinicRoom[] = [
  'appointments',
  'leads',
  'patients',
  'payments',
];

/** The two viewports the launch smoke runs at (KICKOFF §8.6): desktop and phone. */
export const CLINIC_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 375, height: 812 },
} as const;

/** A viewport the clinic smoke runs at. */
export type ClinicTier = keyof typeof CLINIC_VIEWPORTS;

/**
 * Hides the React Query devtools (`VITE_DEVTOOLS`, on in local development):
 * on a phone their floating toggle sits over the tab bar's "More" and takes its
 * clicks. They are dev tooling, not the product, so they go before the app boots.
 */
export async function hideDevtools(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Init scripts run before the parser has built <head>, so wait for it.
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = '.tsqd-parent-container { display: none !important; }';
      document.head.append(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide, { once: true });
  });
}

/**
 * A brand-new user who owns a brand-new clinic (a team organization), signed in
 * and standing in it on their role home — Today for an owner (D25).
 *
 * Every request goes through `page.request`, the app's own origin and its
 * `/api` proxy, so the refresh cookie lands in the browser context and a cold
 * `page.goto` (a deep link) restores the session. The page takes the token
 * already scoped to the clinic, so the guards meet a provisioned owner. Skips
 * when the live clinozy-be has team organizations turned off — there is no
 * clinic to open then. `email` signs in a given address instead of a fresh one —
 * someone a spec has already invited elsewhere, say.
 */
export async function openNewClinic(
  page: Page,
  options: { email?: string } = {},
): Promise<{ slug: string; email: string }> {
  await hideDevtools(page);
  await gotoApp(page, '/login');
  await expectLoginFormReady(page);

  const { accessToken, email } = await createSessionViaEmailCode(
    page.request,
    options.email,
  );
  const { flags } = await probeLiveDeployment(page.request, accessToken);
  test.skip(
    !flags.teamOrganizations,
    'team organizations are off on this clinozy-be (TEAM_ORGANIZATION_ENABLED=false)',
  );
  const { createStatus, org, teamToken } = await createTeamOrganization(
    page.request,
    accessToken,
  );
  const slug = org?.slug ?? '';
  expect(slug, `the clinic was not created (${createStatus})`).not.toBe('');

  await establishSessionInPage(page, teamToken);

  await navigateInApp(page, `/organization/${slug}`);
  await expectRoomReady(page, 'today');
  return { slug, email };
}

/**
 * The room is on screen: its URL, its page root and — the a11y guard — its
 * name as the page's one `h1`.
 */
export async function expectRoomReady(page: Page, room: ClinicRoom): Promise<void> {
  const { path, testId, heading } = CLINIC_ROOM_PAGES[room];
  await expect(page).toHaveURL(new RegExp(`/organization/[^/]+/${path}(?:[?#]|$)`), {
    timeout: 15_000,
  });
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

/** A record drawer is open and exposed as a dialog (the a11y guard). */
export async function expectDrawer(page: Page, testId: string): Promise<void> {
  const drawer = byTestId(page, testId);
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer).toHaveAttribute('role', 'dialog');
}

/**
 * Opens the first body row of a room's list with Enter — the row's keyboard
 * path, which no control inside the row's cells can take for itself.
 */
export async function openFirstRow(rows: Locator): Promise<void> {
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await rows.first().press('Enter');
}

/**
 * Opens a room the way a member does: a pinned room from its tab (the header
 * from `md`, the tab bar on a phone), any other from All sections (the popover
 * from `md`, the sheet behind the tab bar's "More" on a phone).
 */
export async function openRoomFromShell(
  page: Page,
  room: ClinicRoom,
  tier: ClinicTier,
): Promise<void> {
  if (PINNED_BY_DEFAULT.includes(room)) {
    await byTestId(page, `nav-${room}`).click();
  } else {
    const phone = tier === 'phone';
    await byTestId(page, phone ? 'nav-more-sections' : 'all-sections-trigger').click();
    const sections = page.getByTestId(phone ? 'all-sections-sheet' : 'all-sections');
    await expect(sections).toBeVisible();
    await sections.getByTestId(`all-sections-${room}`).click();
    await expect(sections).toBeHidden();
  }
  await expectRoomReady(page, room);
}
