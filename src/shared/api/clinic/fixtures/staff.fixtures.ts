import { seedCommon } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type { Presence, Role, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { staffInitials, type StaffProfile } from '@/shared/api/clinic/users-contracts.ts';

import { type BranchName, branchRef, weekdays } from './organization.fixtures.ts';
import { must, ref, seedAt, seedMobile } from './refs.fixtures.ts';

/**
 * The prototype's people keys (`LOWN` H:3372, `AP_DOCS` H:3419) — every seed
 * names staff by these initials. DN is Dr. Nisha Mavani.
 */
export type StaffKey =
  'RS' | 'DR' | 'DD' | 'DN' | 'NK' | 'KS' | 'KP' | 'AS' | 'FA' | 'MJ';

const STAFF_SEQ: Record<StaffKey, number> = {
  RS: 12,
  DR: 11,
  DD: 9,
  DN: 2,
  NK: 13,
  KS: 14,
  KP: 15,
  AS: 16,
  FA: 17,
  MJ: 18,
};

/** The user id behind a prototype people key. */
export const staffRef = (key: StaffKey): string => ref.user(STAFF_SEQ[key]);

/**
 * The signed-in member as the fixture server sees them — the prototype's `ME`,
 * Riya Shah (H:3373) — until the session carries a staff profile (L-31).
 * "Mine", "(you)" and every owner-me rule read it (REPLACE_WITH_API: the
 * server knows the member from the token).
 */
export const FIXTURE_VIEWER_ID = staffRef('RS');

const ROLES: Record<string, Role> = {
  Admin: 'admin',
  Doctor: 'doctor',
  Therapist: 'therapist',
  'Front desk': 'front_desk',
  Counsellor: 'counsellor',
  Pharmacist: 'pharmacist',
  Accountant: 'accountant',
};

interface StaffRow {
  seq: number;
  first: string;
  last: string;
  email: string;
  phone: string | null;
  roles: readonly string[];
  tone: Tone;
  branches: readonly BranchName[];
  /** Prototype weekday indexes, Mon = 0. */
  days: readonly number[];
  from: string;
  to: string;
  commission: number;
  active: boolean;
  /** When the account was created (prototype label). */
  since: string;
  /** The Team table's "Updated" (prototype label). */
  updated: string;
  presence: Presence;
  lastActive: string | null;
}

const WEEK = [0, 1, 2, 3, 4, 5];

/**
 * `US_SEED` (H:3593–3604), verbatim — its last column is the Team table's
 * "Updated", which for every account but Riya's is also when it was made.
 * Presence and last activity come from `PEOPLE` (H:3374) and the team list
 * (H:3336). "Dr Drashti" gets the "Dr." every other seed gives her (H:3372).
 */
const TEAM_ROWS: readonly StaffRow[] = [
  {
    seq: 12,
    first: 'Riya',
    last: 'Shah',
    email: 'riya@cresence.skin',
    phone: '98250 44120',
    roles: ['Front desk', 'Admin'],
    tone: 'blush',
    branches: ['Adajan', 'Vesu'],
    days: WEEK,
    from: '09:30',
    to: '19:30',
    commission: 0,
    active: true,
    since: 'Jul 07, 2025 · 12:00',
    updated: 'Today · 09:02',
    presence: 'online',
    lastActive: 'Today · 10:30',
  },
  {
    seq: 11,
    first: 'Dr. Reenal',
    last: 'Chaniyara',
    email: 'reenal@cresence.skin',
    phone: '93287 90051',
    roles: ['Doctor'],
    tone: 'lav',
    branches: ['Adajan'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 10,
    active: true,
    since: 'Aug 23 · 11:52',
    updated: 'Aug 23 · 11:52',
    presence: 'away',
    lastActive: 'Yesterday · 18:00',
  },
  {
    seq: 10,
    first: 'Foram',
    last: 'Kanpariya',
    email: 'foram@cresence.skin',
    phone: '88497 38851',
    roles: ['Front desk', 'Counsellor'],
    tone: 'mint',
    branches: ['Adajan'],
    days: WEEK,
    from: '09:30',
    to: '19:30',
    commission: 0,
    active: true,
    since: 'Apr 23 · 14:59',
    updated: 'Apr 23 · 14:59',
    presence: 'away',
    lastActive: null,
  },
  {
    seq: 9,
    first: 'Dr. Drashti',
    last: 'Moradiya',
    email: 'drashti@cresence.skin',
    phone: '95743 89680',
    roles: ['Doctor'],
    tone: 'sky',
    branches: ['Adajan', 'Vesu'],
    days: [0, 1, 2, 3, 4],
    from: '10:00',
    to: '18:00',
    commission: 12,
    active: true,
    since: 'Dec 09, 2025 · 10:38',
    updated: 'Dec 09, 2025 · 10:38',
    presence: 'away',
    lastActive: 'Sep 25 · 17:00',
  },
  {
    seq: 8,
    first: 'Ridhi',
    last: 'Sohaliya',
    email: 'ridhi@cresence.skin',
    phone: '76230 23490',
    roles: ['Therapist'],
    tone: 'blush',
    branches: ['Adajan'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 5,
    active: true,
    since: 'Jul 25, 2025 · 10:23',
    updated: 'Jul 25, 2025 · 10:23',
    presence: 'away',
    lastActive: null,
  },
  {
    seq: 7,
    first: 'Samya',
    last: 'Sojitra',
    email: 'samya@cresence.skin',
    phone: '63511 73599',
    roles: ['Therapist'],
    tone: 'sage',
    branches: ['Vesu'],
    days: [1, 2, 3, 4, 5],
    from: '11:00',
    to: '20:00',
    commission: 5,
    active: false,
    since: 'Jul 25, 2025 · 10:21',
    updated: 'Jul 25, 2025 · 10:21',
    presence: 'away',
    lastActive: null,
  },
  {
    seq: 6,
    first: 'Nikunj',
    last: 'Mavani',
    email: 'nikunj@cresence.skin',
    phone: '90335 18171',
    roles: ['Admin'],
    tone: 'butter',
    branches: ['Adajan', 'Vesu', 'Varachha'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: true,
    since: 'Jul 17, 2025 · 07:28',
    updated: 'Jul 17, 2025 · 07:28',
    presence: 'away',
    lastActive: null,
  },
  {
    seq: 3,
    first: 'Daxil',
    last: 'Vaghani',
    email: 'daxil@cresence.skin',
    phone: '98989 89898',
    roles: ['Admin'],
    tone: 'lav',
    branches: ['Adajan'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: true,
    since: 'Jul 07, 2025 · 18:11',
    updated: 'Jul 07, 2025 · 18:11',
    presence: 'away',
    lastActive: null,
  },
  {
    seq: 2,
    first: 'Dr. Nisha',
    last: 'Mavani',
    email: 'nisha@cresence.skin',
    phone: '84606 79899',
    roles: ['Doctor', 'Admin'],
    tone: 'butter',
    branches: ['Adajan', 'Vesu'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 15,
    active: true,
    since: 'Jul 07, 2025 · 11:02',
    updated: 'Jul 07, 2025 · 11:02',
    presence: 'online',
    lastActive: 'Today · 10:40',
  },
  {
    seq: 1,
    first: 'Admin',
    last: 'Cresence Skin',
    email: 'admin@cresence.skin',
    phone: '74900 20099',
    roles: ['Admin'],
    tone: 'sage',
    branches: ['Adajan', 'Vesu', 'Varachha'],
    days: [0, 1, 2, 3, 4, 5, 6],
    from: '00:00',
    to: '23:59',
    commission: 0,
    active: true,
    since: 'Jul 07, 2025 · 11:01',
    updated: 'Jul 07, 2025 · 11:01',
    presence: 'away',
    lastActive: null,
  },
];

const JOINED = 'Jul 20, 2025 · 10:00';

/**
 * The six people every other seed names but `US_SEED` leaves out (`LOWN` /
 * `PEOPLE` H:3372–3374; roles and branches from the team list H:3336). The
 * prototype knows them only as "Nidhi K." and the like, so the initial is the
 * last name; their e-mails follow the clinic's pattern and they have no phone.
 * Asha M. has left (`PEOPLE.AS.left`), so her account is inactive.
 */
const FLOOR_ROWS: readonly StaffRow[] = [
  {
    seq: 13,
    first: 'Nidhi',
    last: 'K.',
    email: 'nidhi@cresence.skin',
    phone: null,
    roles: ['Counsellor'],
    tone: 'sage',
    branches: ['Adajan', 'Vesu'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: true,
    since: JOINED,
    updated: JOINED,
    presence: 'online',
    lastActive: 'Today · 10:05',
  },
  {
    seq: 14,
    first: 'Dr. Karan',
    last: 'Shah',
    email: 'karan@cresence.skin',
    phone: null,
    roles: ['Doctor'],
    tone: 'sky',
    branches: ['Adajan'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: true,
    since: JOINED,
    updated: JOINED,
    presence: 'away',
    lastActive: 'Today · 10:12',
  },
  {
    seq: 15,
    first: 'Kiran',
    last: 'P.',
    email: 'kiran@cresence.skin',
    phone: null,
    roles: ['Therapist'],
    tone: 'mint',
    branches: ['Adajan'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: true,
    since: JOINED,
    updated: JOINED,
    presence: 'busy',
    lastActive: 'Today · 10:15',
  },
  {
    seq: 16,
    first: 'Asha',
    last: 'M.',
    email: 'asha@cresence.skin',
    phone: null,
    roles: ['Front desk'],
    tone: 'blush',
    branches: ['Adajan'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: false,
    since: JOINED,
    updated: 'Sep 24 · 20:15',
    presence: 'away',
    lastActive: 'Sep 24 · 20:15',
  },
  {
    seq: 17,
    first: 'Farah',
    last: 'A.',
    email: 'farah@cresence.skin',
    phone: null,
    roles: ['Pharmacist'],
    tone: 'mint',
    branches: ['Adajan'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: true,
    since: JOINED,
    updated: JOINED,
    presence: 'away',
    lastActive: 'Yesterday · 18:00',
  },
  {
    seq: 18,
    first: 'Mehul',
    last: 'J.',
    email: 'mehul@cresence.skin',
    phone: null,
    roles: ['Accountant'],
    tone: 'butter',
    branches: ['Adajan', 'Vesu', 'Varachha'],
    days: WEEK,
    from: '10:00',
    to: '19:00',
    commission: 0,
    active: true,
    since: JOINED,
    updated: JOINED,
    presence: 'away',
    lastActive: 'Yesterday · 18:30',
  },
];

/**
 * Every staff member's profile: the ten Team rows, then the six floor staff.
 * No membership claims a seeded profile until one with its email joins (L-31).
 */
export function staffSeed(today: string = clinicToday()): StaffProfile[] {
  return [...TEAM_ROWS, ...FLOOR_ROWS].map((row) => {
    const roles = row.roles.map((label) => must(ROLES[label], `role ${label}`));
    return {
      ...seedCommon(
        seedAt(row.since, '10:00', today),
        ref.user(1),
        seedAt(row.updated, '10:00', today),
      ),
      id: ref.user(row.seq),
      seq: row.seq,
      firstName: row.first,
      lastName: row.last,
      initials: staffInitials(`${row.first} ${row.last}`),
      email: row.email,
      phone: row.phone === null ? null : seedMobile(row.phone),
      roles,
      roleKeys: roles,
      membershipId: null,
      branchIds: row.branches.map(branchRef),
      tone: row.tone,
      workingDays: weekdays(row.days),
      startsAt: row.from,
      endsAt: row.to,
      commissionPct: row.commission,
      active: row.active,
      presence: row.presence,
      lastActiveAt:
        row.lastActive === null ? null : seedAt(row.lastActive, '10:00', today),
    };
  });
}
