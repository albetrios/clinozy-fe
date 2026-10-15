import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  test,
} from '@playwright/test';

import {
  APP_ROOM_PAGES,
  type AppRoom,
  expectRoomReady,
  hideDevtools,
  seedData,
} from '@/tests/utils/e2e-app.ts';
import { establishSessionInPage, navigateInApp } from '@/tests/utils/e2e-auth.ts';
import { probeLiveDeployment } from '@/tests/utils/e2e-deployment-mode.ts';
import { byTestId, gotoApp } from '@/tests/utils/e2e-hybrid.ts';
import { createSessionViaEmailCode } from '@/tests/utils/e2e-session.ts';
import { bearerHeaders, createTeamOrganization } from '@/tests/utils/e2e-tenancy.ts';

/**
 * Role QA (L-60, D157): a member sees the clinic their permission codes allow — no more, no less.
 * The spec opens its own clinic on the live clinozy-be (never a shared one) with one branch and one
 * patient, and walks it as each preset View-as can preview — Front desk, Doctor, Therapist,
 * Counsellor, Pharmacist, Accountant and Marketing (Admin is the locked role and offers no preview;
 * the Owner is the session itself): their home,
 * the rooms that open and the ones that send them away, the create and money controls, and the
 * patient file's clinical sections. The codes are clinozy-be's presets (after D83), read by the
 * role's id; the client keeps no role matrix.
 *
 * Each role is walked through the owner's View-as ("Preview as <role>"), which gates every screen
 * on the previewed role's codes exactly as a member's own: a local clinic's Free plan holds one
 * seat, so no member can be invited here (`409 seat_limit_reached`, and no flag lifts it). Real
 * members of every preset were driven on the local stack in the role QA (Role QA Clinic B), and
 * the server's own gates by clinozy-be's role matrix.
 *
 * Local only: it needs clinozy-be on :3000 with team organizations on.
 */

const API = '/api/v1';

/** What one preset role should meet in the clinic. */
interface RoleExpectation {
  /** The role's name as clinozy-be provisions it. */
  role: string;
  /** Where the member lands (`appHomeSection`, D25 on codes). */
  home: AppRoom;
  /** Rooms that open. */
  opens: readonly AppRoom[];
  /** Rooms that send the member on to a room they can view. */
  sendsAway: readonly AppRoom[];
  /** Where those send them: the first room they can view after Today, in nav order (Q-U11). */
  landsOn: AppRoom;
  /** Controls shown, by the room they sit in. */
  shows: readonly (readonly [AppRoom, string])[];
  /** Controls absent, by the room they would sit in. */
  hides: readonly (readonly [AppRoom, string])[];
  /** Whether the patient file opens on its Prescriptions section (`patient_prescription:read`). */
  readsPrescriptions: boolean;
}

const ROLES: readonly RoleExpectation[] = [
  {
    role: 'Front desk',
    home: 'today',
    opens: [
      'leads',
      'appointments',
      'patients',
      'stock',
      'payments',
      'tasks',
      'offerings',
    ],
    sendsAway: ['medical', 'users', 'branches'],
    landsOn: 'leads',
    shows: [
      ['today', 'today-new-booking'],
      ['patients', 'patients-new'],
      ['payments', 'payments-receive'],
    ],
    hides: [],
    readsPrescriptions: false,
  },
  {
    role: 'Doctor',
    home: 'today',
    opens: [
      'leads',
      'appointments',
      'patients',
      'medical',
      'payments',
      'tasks',
      'offerings',
    ],
    sendsAway: ['stock', 'users', 'branches'],
    landsOn: 'leads',
    shows: [
      ['patients', 'patients-new'],
      ['appointments', 'appointments-new-appointment'],
    ],
    // Reads the bills, takes no money.
    hides: [['payments', 'payments-receive']],
    readsPrescriptions: true,
  },
  {
    role: 'Therapist',
    home: 'today',
    opens: ['appointments', 'patients', 'stock', 'tasks', 'offerings'],
    sendsAway: ['leads', 'medical', 'payments', 'users', 'branches'],
    landsOn: 'appointments',
    shows: [
      ['appointments', 'appointments-new-appointment'],
      ['patients', 'patients-new'],
    ],
    // Today's New booking starts from an enquiry (`lead:create`), which a therapist does not hold.
    hides: [['today', 'today-new-booking']],
    readsPrescriptions: true,
  },
  {
    role: 'Counsellor',
    home: 'today',
    opens: ['leads', 'appointments', 'patients', 'payments', 'tasks', 'offerings'],
    sendsAway: ['medical', 'stock', 'users', 'branches'],
    landsOn: 'leads',
    shows: [
      ['today', 'today-new-booking'],
      ['leads', 'leads-new-lead'],
      ['patients', 'patients-new'],
      // Fixes the bills it makes (D83 (4)).
      ['payments', 'payments-receive'],
    ],
    hides: [],
    readsPrescriptions: true,
  },
  {
    role: 'Pharmacist',
    home: 'medical',
    opens: [
      'today',
      'appointments',
      'patients',
      'medical',
      'stock',
      'payments',
      'tasks',
      'offerings',
    ],
    sendsAway: ['leads', 'users', 'branches'],
    landsOn: 'appointments',
    // Sells and collects (payment:create); reads the patients and the day's visits only.
    shows: [['payments', 'payments-receive']],
    hides: [
      ['today', 'today-new-booking'],
      ['appointments', 'appointments-new-appointment'],
      ['patients', 'patients-new'],
    ],
    readsPrescriptions: true,
  },
  {
    role: 'Accountant',
    home: 'payments',
    opens: ['patients', 'medical', 'stock', 'payments', 'offerings'],
    sendsAway: ['leads', 'appointments', 'tasks', 'users', 'branches'],
    landsOn: 'patients',
    shows: [['payments', 'payments-receive']],
    hides: [
      ['today', 'today-new-booking'],
      ['patients', 'patients-new'],
    ],
    readsPrescriptions: false,
  },
  {
    role: 'Marketing',
    home: 'leads',
    opens: ['leads', 'patients', 'tasks', 'offerings'],
    sendsAway: ['appointments', 'medical', 'stock', 'payments', 'users', 'branches'],
    landsOn: 'leads',
    shows: [
      ['leads', 'leads-new-lead'],
      ['today', 'today-new-booking'],
    ],
    hides: [['patients', 'patients-new']],
    readsPrescriptions: false,
  },
];

/** The clinic the spec opens: the owner's token scoped to it, and each role's id. */
interface Clinic {
  slug: string;
  patientId: string;
  ownerToken: string;
  roleIds: Map<string, string>;
}

/** The clinic's main branch and one patient in it, made by the owner. */
async function seedPatient(api: APIRequestContext, ownerToken: string): Promise<string> {
  const branch = await seedData<{ id: string }>(
    await api.post(`${API}/app/branches`, {
      headers: bearerHeaders(ownerToken, true),
      data: {
        name: 'Role QA',
        address_line_one: '12, Ocean Arcade',
        area: 'Vesu',
        city: 'Surat',
        postal_code: '395007',
        phone: '+919876543210',
        email: 'role-qa@example.com',
      },
    }),
    'branch',
  );
  const patient = await seedData<{ id: string }>(
    await api.post(`${API}/app/patients`, {
      headers: bearerHeaders(ownerToken, true),
      data: {
        home_branch_id: branch.id,
        contact: {
          first_name: 'Role',
          last_name: 'Check',
          phones: [{ phone: '+919825044120', is_primary: true }],
        },
        allergies: ['Penicillin'],
      },
    }),
    'patient',
  );
  return patient.id;
}

/** Open the clinic on the live clinozy-be: its owner, its roles, one branch and one patient. */
async function openClinic(api: APIRequestContext): Promise<Clinic | null> {
  const { accessToken } = await createSessionViaEmailCode(api);
  const { flags } = await probeLiveDeployment(api, accessToken);
  if (!flags.teamOrganizations) return null;
  const { org, teamToken } = await createTeamOrganization(api, accessToken);
  if (!org?.slug) throw new Error('the clinic was not created');
  const roles = await seedData<{ id: string; name: string }[]>(
    await api.get(`${API}/tenancy/organization/roles`, {
      headers: bearerHeaders(teamToken),
    }),
    'roles',
  );
  const patientId = await seedPatient(api, teamToken);
  const roleIds = new Map(roles.map((role) => [role.name, role.id]));
  return { slug: org.slug, patientId, ownerToken: teamToken, roleIds };
}

/**
 * A page signed in as the owner, previewing `role` from its Roles & access page, then standing
 * where the clinic's home sends that role.
 */
async function previewAs(browser: Browser, clinic: Clinic, role: string): Promise<Page> {
  const roleId = clinic.roleIds.get(role);
  if (!roleId) throw new Error(`no ${role} role in the new clinic`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await hideDevtools(page);
  await gotoApp(page, '/login');
  await establishSessionInPage(page, clinic.ownerToken);
  await navigateInApp(page, `/organization/${clinic.slug}/users/roles?role=${roleId}`);
  await byTestId(page, 'users-role-preview').click();
  await navigateInApp(page, `/organization/${clinic.slug}`);
  return page;
}

/** Open a room by its URL, as a link would. */
async function visit(page: Page, clinic: Clinic, room: AppRoom): Promise<void> {
  await navigateInApp(page, `/organization/${clinic.slug}/${APP_ROOM_PAGES[room].path}`);
}

let clinic: Clinic | null = null;

test.describe('clinic roles — each preset sees what its codes allow (L-60, D157)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(240_000);
    const api = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    try {
      clinic = await openClinic(api);
    } finally {
      await api.dispose();
    }
  });

  for (const expectation of ROLES) {
    test(`${expectation.role}: home, rooms, controls and the clinical record`, async ({
      browser,
    }) => {
      test.skip(clinic === null, 'team organizations are off on this clinozy-be');
      if (!clinic) return;
      const page = await previewAs(browser, clinic, expectation.role);
      try {
        await expectRoomReady(page, expectation.home);

        for (const room of expectation.opens) {
          await visit(page, clinic, room);
          await expectRoomReady(page, room);
        }
        for (const room of expectation.sendsAway) {
          // From a room the role opens, so the move is the redirect's, not a stale URL.
          await visit(page, clinic, expectation.home);
          await expectRoomReady(page, expectation.home);
          await visit(page, clinic, room);
          await expectRoomReady(page, expectation.landsOn);
          await expect(page.getByTestId(APP_ROOM_PAGES[room].testId)).toHaveCount(0);
        }

        for (const [room, control] of expectation.shows) {
          await visit(page, clinic, room);
          await expectRoomReady(page, room);
          await expect(byTestId(page, control)).toBeVisible();
        }
        for (const [room, control] of expectation.hides) {
          await visit(page, clinic, room);
          await expectRoomReady(page, room);
          await expect(page.getByTestId(control)).toHaveCount(0);
        }

        const file = `/organization/${clinic.slug}/patients/${clinic.patientId}`;
        const prescriptions = `${file}/prescriptions`;
        const timeline = `${file}/timeline`;
        await navigateInApp(page, prescriptions);
        await expect(page.getByTestId('patient-file-layout')).toBeVisible({
          timeout: 15_000,
        });
        // Without the section's code the file opens on its default section, Timeline (D19).
        const landing = expectation.readsPrescriptions ? prescriptions : timeline;
        await expect(page).toHaveURL(new RegExp(`${landing}(?:[?#]|$)`), {
          timeout: 15_000,
        });
      } finally {
        await page.close();
      }
    });
  }
});
