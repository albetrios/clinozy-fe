import { z } from 'zod';

import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import type { Tone, Weekday } from '@/shared/api/clinic/clinic-schema.ts';
import { clockMinutes, clockOfMinutes } from '@/shared/api/clinic/clinic-time.ts';
import {
  STAFF_PROFILE_DEFAULTS,
  type StaffProfileInput,
  type TeamMember,
} from '@/shared/api/clinic/users-contracts.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { clinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';

/**
 * The user drawer's form (KICKOFF §6.12; `users.md:99–124`): one Name field,
 * the mobile's digits, the sign-in email, the badge colour, the clinic roles
 * in pick order (the first is the main role), the branches, the working
 * week, the commission and the status. No password (D17).
 */
export interface UserFormValues {
  name: string;
  /** The mobile's digits, at most ten (`DrawerPhoneInput`). */
  phone: string;
  email: string;
  tone: Tone;
  roleKeys: ClinicRoleKey[];
  branchIds: string[];
  workingDays: Weekday[];
  startsAt: string;
  endsAt: string;
  /** A whole percentage; the stepper reads an emptied box as 0. */
  commissionPct: number;
  /** Active · can sign in (a membership `active`), else `suspended`. */
  active: boolean;
}

/** The user drawer's two steps (`users.md:274`), for every role and viewport. */
export type UserDrawerStepId = 'profile' | 'hours';

/** The Colour field's swatches, in the design's order (`users.md:109`). */
export const USER_TONES = [
  'lav',
  'sky',
  'butter',
  'blush',
  'sage',
  'mint',
  'peach',
  'plum',
] as const satisfies readonly Tone[];

/** The quick commission chips (`users.md:116`). */
export const COMMISSION_QUICK = [0, 5, 10, 15] as const;

/** The form's limits (`users.md:105–107`). */
export const USER_FORM_LIMITS = { name: 60, email: 254 } as const;

/** The time tiles' range: 06:00–23:30, every 30 minutes (`users.md:114`). */
export const USER_TIME_RANGE = { from: '06:00', to: '23:30', step: 30 } as const;

const MON_SAT: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const EVERY_DAY: readonly Weekday[] = [...MON_SAT, 'sun'];

/** One Quick fill preset: it sets the roles, days, hours and commission — never the colour. */
export interface UserQuickFill {
  id: 'doctor' | 'therapist' | 'front_desk' | 'pharmacist';
  tone: Tone;
  values: Pick<
    UserFormValues,
    'roleKeys' | 'workingDays' | 'startsAt' | 'endsAt' | 'commissionPct'
  >;
}

/**
 * The New user Quick fill (`users.md:169, 174`): Doctor Mon–Sat 10:00–19:00 at
 * 10%, Therapist Mon–Sat 10:00–19:00 at 5%, Front desk Mon–Sat 09:30–19:30,
 * Pharmacist every day 09:00–21:00.
 */
export const USER_QUICK_FILLS: readonly UserQuickFill[] = [
  {
    id: 'doctor',
    tone: 'sky',
    values: {
      roleKeys: ['doctor'],
      workingDays: [...MON_SAT],
      startsAt: '10:00',
      endsAt: '19:00',
      commissionPct: 10,
    },
  },
  {
    id: 'therapist',
    tone: 'butter',
    values: {
      roleKeys: ['therapist'],
      workingDays: [...MON_SAT],
      startsAt: '10:00',
      endsAt: '19:00',
      commissionPct: 5,
    },
  },
  {
    id: 'front_desk',
    tone: 'mint',
    values: {
      roleKeys: ['front_desk'],
      workingDays: [...MON_SAT],
      startsAt: '09:30',
      endsAt: '19:30',
      commissionPct: 0,
    },
  },
  {
    id: 'pharmacist',
    tone: 'blush',
    values: {
      roleKeys: ['pharmacist'],
      workingDays: [...EVERY_DAY],
      startsAt: '09:00',
      endsAt: '21:00',
      commissionPct: 0,
    },
  },
];

/**
 * A new user's starting values (`users.md:362`): Front desk, sky, Mon–Sat
 * 10:00–19:00, 0%, Active — on `branchId` (the header's branch, else the
 * main one).
 */
export function emptyUserForm(branchId: string | null): UserFormValues {
  return {
    name: '',
    phone: '',
    email: '',
    tone: STAFF_PROFILE_DEFAULTS.tone,
    roleKeys: [...STAFF_PROFILE_DEFAULTS.roleKeys],
    branchIds: branchId ? [branchId] : [],
    workingDays: [...STAFF_PROFILE_DEFAULTS.workingDays],
    startsAt: STAFF_PROFILE_DEFAULTS.startsAt,
    endsAt: STAFF_PROFILE_DEFAULTS.endsAt,
    commissionPct: STAFF_PROFILE_DEFAULTS.commissionPct,
    active: true,
  };
}

/**
 * A member's form: their staff profile's values — the membership's name and
 * email without one (an email-only name stays empty for the person to fill),
 * Owner left out of the roles (clinozy-be decides who owns the organisation).
 */
export function userFormOf(member: TeamMember): UserFormValues {
  const { profile } = member;
  const defaults = emptyUserForm(null);
  const roleKeys = (profile?.roleKeys ?? member.roleKeys).filter(
    (key) => key !== 'owner',
  );
  return {
    ...defaults,
    name: member.name === member.email ? '' : member.name,
    phone: member.phone ? clinicPhoneDigits(member.phone) : '',
    email: member.email,
    tone: member.tone,
    roleKeys: roleKeys.length > 0 ? roleKeys : defaults.roleKeys,
    branchIds: profile ? [...profile.branchIds] : [...member.branchIds],
    workingDays: profile ? [...profile.workingDays] : defaults.workingDays,
    startsAt: profile?.startsAt ?? defaults.startsAt,
    endsAt: profile?.endsAt ?? defaults.endsAt,
    commissionPct: profile?.commissionPct ?? defaults.commissionPct,
    active: member.status !== 'suspended',
  };
}

/** The required fields still empty, in the form's order: Name, then Email. */
export function missingUserFields(values: UserFormValues): ('name' | 'email')[] {
  const missing: ('name' | 'email')[] = [];
  if (!values.name.trim()) missing.push('name');
  if (!values.email.trim()) missing.push('email');
  return missing;
}

const EMAIL = z.email();

/** Whether an email reads as one — the contract's `string (email)` (§7.2). */
export function isUserEmail(value: string): boolean {
  return EMAIL.safeParse(value.trim()).success;
}

/** A filled mobile that is not ten digits (an empty one is fine). */
export function isMobileIncomplete(digits: string): boolean {
  return digits.length > 0 && toClinicPhone(digits) === null;
}

/** The first `HH:mm` tile after `time` (To lists only times after From, §7.3). */
export function nextClockTime(time: string, step = USER_TIME_RANGE.step): string {
  return clockOfMinutes(Math.min(clockMinutes(time) + step, 24 * 60 - 1));
}

/**
 * The staff profile a save writes (`saveStaffProfile`): the trimmed name and
 * email, the mobile E.164, the commission (0 when emptied) — and, with one
 * open branch, that branch: a user is saved on it (`users.md:95`).
 */
export function userProfileInput(
  values: UserFormValues,
  membershipId: string,
  singleBranchId: string | null,
): StaffProfileInput {
  return {
    membershipId,
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone ? toClinicPhone(values.phone) : null,
    tone: values.tone,
    roleKeys: values.roleKeys,
    branchIds: singleBranchId ? [singleBranchId] : values.branchIds,
    workingDays: values.workingDays,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
    commissionPct: values.commissionPct,
    active: values.active,
  };
}
