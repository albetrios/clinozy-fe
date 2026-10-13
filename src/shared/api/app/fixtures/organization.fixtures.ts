import { seedCommon } from '@/shared/api/app/app-fixture-seed.ts';
import { FIXTURE_ORGANIZATION_ID } from '@/shared/api/app/app-fixture-store.ts';
import type { Branch, Organization, Tone, Weekday } from '@/shared/api/app/app-schema.ts';
import { WEEKDAY_VALUES } from '@/shared/api/app/app-schema.ts';
import { APP_TIME_ZONE, appToday } from '@/shared/api/app/app-time.ts';

import { must, ref, seedAt, seedMobile } from './refs.fixtures.ts';

/** The clinic (`CLINIC`, H:3548). */
export function organizationSeed(): Organization {
  return {
    id: FIXTURE_ORGANIZATION_ID,
    slug: 'cresence-skin',
    name: 'Cresence Skin',
    specialties: ['skin'],
    timezone: APP_TIME_ZONE,
    currency: 'INR',
  };
}

/** The prototype's branch names; the main branch is every record's default. */
export type BranchName = 'Adajan' | 'Vesu' | 'Varachha';
export const MAIN_BRANCH: BranchName = 'Adajan';

interface BranchRow {
  key: number;
  name: BranchName;
  tone: Tone;
  main: boolean;
  lineOne: string;
  lineTwo: string;
  area: string;
  city: string;
  state: string;
  pin: string;
  phone: string;
  email: string;
  gst: string;
  opens: string;
  closes: string;
  /** Prototype weekday indexes, Mon = 0. */
  days: readonly number[];
  /** Default people, by staff `seq` (US_SEED ids). */
  doctor: number | null;
  desk: number | null;
  therapist: number | null;
  pharmacist: number | null;
}

/** `BR_SEED` (H:3567–3570), verbatim. */
const BRANCH_ROWS: readonly BranchRow[] = [
  {
    key: 1,
    name: 'Adajan',
    tone: 'sage',
    main: true,
    lineOne: '3rd floor, Shree Hari Complex',
    lineTwo: 'Near Star Bazaar, Adajan Gam Road',
    area: 'Adajan',
    city: 'Surat',
    state: 'Gujarat',
    pin: '395009',
    phone: '74900 20099',
    email: 'adajan@cresence.skin',
    gst: '24AAKFC4821M1Z6',
    opens: '10:00',
    closes: '20:00',
    days: [0, 1, 2, 3, 4, 5],
    doctor: 2,
    desk: 12,
    therapist: 8,
    pharmacist: null,
  },
  {
    key: 2,
    name: 'Vesu',
    tone: 'sky',
    main: false,
    lineOne: 'Shop 12, Rajhans Platinum',
    lineTwo: 'VIP Road',
    area: 'Vesu',
    city: 'Surat',
    state: 'Gujarat',
    pin: '395007',
    phone: '74900 20098',
    email: 'vesu@cresence.skin',
    gst: '24AAKFC4821M2Z5',
    opens: '11:00',
    closes: '20:00',
    days: [1, 2, 3, 4, 5, 6],
    doctor: 9,
    desk: null,
    therapist: 7,
    pharmacist: null,
  },
  {
    key: 3,
    name: 'Varachha',
    tone: 'butter',
    main: false,
    lineOne: '2nd floor, Sarthana Business Hub',
    lineTwo: 'Varachha Main Road',
    area: 'Varachha',
    city: 'Surat',
    state: 'Gujarat',
    pin: '395006',
    phone: '74900 20097',
    email: 'varachha@cresence.skin',
    gst: '',
    opens: '10:00',
    closes: '19:00',
    days: [0, 1, 2, 3, 4, 5],
    doctor: null,
    desk: null,
    therapist: null,
    pharmacist: null,
  },
];

/** The prototype's weekday indexes (Mon = 0) as the contract's `weekday` values. */
export const weekdays = (days: readonly number[]): Weekday[] =>
  days.map((day) => must(WEEKDAY_VALUES[day], `weekday ${day}`));

const staffRefOrNull = (seq: number | null) => (seq === null ? null : ref.user(seq));

/** The id of a branch by its name. */
export function branchRef(name: BranchName): string {
  return ref.branch(
    must(
      BRANCH_ROWS.find((row) => row.name === name),
      `branch ${name}`,
    ).key,
  );
}

/** The branches, opened with the clinic on the admin account's first day (H:3603). */
export function branchSeed(today: string = appToday()): Branch[] {
  return BRANCH_ROWS.map((row) => ({
    ...seedCommon(seedAt(`Jul 07, 2025 · 11:0${row.key}`, '11:00', today), ref.user(1)),
    id: ref.branch(row.key),
    name: row.name,
    tone: row.tone,
    isMain: row.main,
    addressLine1: row.lineOne,
    addressLine2: row.lineTwo || null,
    area: row.area,
    city: row.city,
    state: row.state,
    pin: row.pin,
    phone: seedMobile(row.phone),
    email: row.email,
    gstNumber: row.gst || null,
    opensAt: row.opens,
    closesAt: row.closes,
    workingDays: weekdays(row.days),
    defaultDoctorId: staffRefOrNull(row.doctor),
    defaultDeskId: staffRefOrNull(row.desk),
    defaultTherapistId: staffRefOrNull(row.therapist),
    defaultPharmacistId: staffRefOrNull(row.pharmacist),
    active: true,
  }));
}
