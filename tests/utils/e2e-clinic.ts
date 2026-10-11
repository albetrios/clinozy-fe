import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import { establishSessionInPage, navigateInApp } from '@/tests/utils/e2e-auth.ts';
import { probeLiveDeployment } from '@/tests/utils/e2e-deployment-mode.ts';
import { byTestId, expectLoginFormReady, gotoApp } from '@/tests/utils/e2e-hybrid.ts';
import { createSessionViaEmailCode } from '@/tests/utils/e2e-session.ts';
import { bearerHeaders, createTeamOrganization } from '@/tests/utils/e2e-tenancy.ts';

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

const API = '/api/v1';

/** Every weekday: the seeded clinic and its owner work all week, so a booking fits any day. */
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** The records a room's happy path opens in a new clinic, made by its owner through the API. */
export interface ClinicSeed {
  branchId: string;
  offeringId: string;
  patientId: string;
  leadId: string;
  taskId: string;
  /** A booking later today, in the arriving lane; `null` when no slot is left today. */
  appointmentId: string | null;
}

/** A `data` answer, or a thrown error naming the call. */
async function seedData<T>(
  response: Awaited<ReturnType<APIRequestContext['post']>>,
  call: string,
): Promise<T> {
  if (!response.ok()) {
    throw new Error(`seed ${call} failed: ${response.status()} ${await response.text()}`);
  }
  return ((await response.json()) as { data: T }).data;
}

/** A mobile number no other seeded person in the clinic has (`contact_phone_exists`). */
function seedPhone(): string {
  return `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

/** Today in `timeZone`, as the API's `appointment_date` (`YYYY-MM-DD`). */
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/**
 * Fills a brand-new clinic with one of everything the rooms list — a branch open all week, an
 * offering, a patient, a lead, a task for the owner and a booking later today — so every room's
 * happy path meets a real row on the live clinozy-be. The owner works every day and every hour, so
 * the booking does not depend on the weekday the suite runs on.
 */
export async function seedClinic(
  api: APIRequestContext,
  token: string,
): Promise<ClinicSeed> {
  const write = (path: string, data: unknown, method: 'post' | 'patch' = 'post') =>
    api[method](`${API}${path}`, { headers: bearerHeaders(token, true), data });
  const read = (path: string) =>
    api.get(`${API}${path}`, { headers: bearerHeaders(token) });

  const context = await seedData<{ membership_id: string }>(
    await read('/auth/me/context'),
    'context',
  );
  const ownerId = context.membership_id;
  await seedData(
    await write(
      `/tenancy/organization/memberships/${ownerId}`,
      { working_days: EVERY_DAY, work_starts_at: '00:00', work_ends_at: '23:59' },
      'patch',
    ),
    'owner hours',
  );
  const organization = await seedData<{ timezone: string }>(
    await read('/tenancy/organization'),
    'organization',
  );
  const branch = await seedData<{ id: string }>(
    await write('/app/branches', {
      name: 'Main',
      address_line_one: '12, Ocean Arcade',
      area: 'Vesu',
      city: 'Surat',
      postal_code: '395007',
      phone: seedPhone(),
      email: 'main@example.com',
      opens_at: '00:00',
      closes_at: '23:59',
      working_days: EVERY_DAY,
    }),
    'branch',
  );
  const offering = await seedData<{ id: string }>(
    await write('/app/offerings', {
      name: 'Skin consultation',
      category: 'consultation',
      specialty: 'skin',
      tone: 'sky',
      price: 500,
      duration_minutes: 15,
      gst_percent: 18,
      is_gst_inclusive: true,
      branch_ids: [branch.id],
    }),
    'offering',
  );
  const patient = await seedData<{ id: string; contact_id: string }>(
    await write('/app/patients', {
      home_branch_id: branch.id,
      contact: {
        first_name: 'Asha',
        last_name: 'Patel',
        phones: [{ phone: seedPhone(), is_primary: true }],
      },
    }),
    'patient',
  );
  const lead = await seedData<{ id: string }>(
    await write('/app/leads', {
      contact: {
        first_name: 'Neha',
        last_name: 'Shah',
        phones: [{ phone: seedPhone(), is_primary: true }],
      },
      source: 'instagram',
      branch_id: branch.id,
      owner_membership_id: ownerId,
    }),
    'lead',
  );
  const task = await seedData<{ id: string }>(
    await write('/app/tasks', {
      title: 'Call Asha about her consultation',
      due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      owner_membership_id: ownerId,
      contact_id: patient.contact_id,
    }),
    'task',
  );

  const date = todayIn(organization.timezone);
  const slots = await seedData<{ slots: { start_time: string }[] }>(
    await read(
      `/app/appointments/slots?branch_id=${branch.id}&appointment_date=${date}` +
        `&duration_minutes=15&doctor_membership_id=${ownerId}`,
    ),
    'slots',
  );
  const start = slots.slots[0]?.start_time;
  const appointment = start
    ? await seedData<{ id: string }>(
        await write('/app/appointments', {
          contact_id: patient.contact_id,
          branch_id: branch.id,
          doctor_membership_id: ownerId,
          appointment_date: date,
          start_time: start,
          type: 'consultation',
          offering_id: offering.id,
          duration_minutes: 15,
        }),
        'appointment',
      )
    : null;

  return {
    branchId: branch.id,
    offeringId: offering.id,
    patientId: patient.id,
    leadId: lead.id,
    taskId: task.id,
    appointmentId: appointment?.id ?? null,
  };
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
 * someone a spec has already invited elsewhere, say. `seed` fills the clinic
 * (`seedClinic`) before the owner walks in, so the rooms have rows to open.
 */
export async function openNewClinic(
  page: Page,
  options: { email?: string; seed?: boolean } = {},
): Promise<{ slug: string; email: string; seed: ClinicSeed | null }> {
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

  const seed = options.seed ? await seedClinic(page.request, teamToken) : null;

  await establishSessionInPage(page, teamToken);

  await navigateInApp(page, `/organization/${slug}`);
  await expectRoomReady(page, 'today');
  return { slug, email, seed };
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
