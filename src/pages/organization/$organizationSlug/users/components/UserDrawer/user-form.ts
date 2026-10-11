import { z } from 'zod';

import type { Role, Tone, Weekday } from '@/shared/api/app/app-schema.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import type { MemberChange, MemberInvite } from '@/shared/api/organization-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';
import { appPhoneDigits } from '@/shared/app/app-phone-field.ts';

/**
 * The user drawer's form (KICKOFF §6.12; `users.md:99–124`; research-users §3): the mobile's
 * digits, the sign-in email, the badge colour, the roles in pick order (the first is the main
 * role), the branches, the working week, the commission and the status. The name is the person's
 * own (it follows their profile) — read here, never sent. No password (D17).
 */
export interface UserFormValues {
  /** The person's name as clinozy-be shows it — read-only. */
  name: string;
  /** The mobile's digits, at most ten (`DrawerPhoneInput`). */
  phone: string;
  email: string;
  tone: Tone;
  /** Role ids (`rol_…`) in pick order, the main role first — 1 to 10. */
  roleIds: string[];
  branchIds: string[];
  workingDays: Weekday[];
  startsAt: string;
  endsAt: string;
  /** A percentage — whole from the stepper, up to two decimals as clinozy-be keeps it. */
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

/** The form's limits (`users.md:105–107`; clinozy-be takes 1–10 roles). */
export const USER_FORM_LIMITS = { email: 254, roles: 10 } as const;

const MON_SAT: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const EVERY_DAY: readonly Weekday[] = [...MON_SAT, 'sun'];

/**
 * One Quick fill preset: it sets the preset's role (the clinic's role of that preset — none when
 * the clinic has no such role), days, hours and commission — never the colour.
 */
export interface UserQuickFill {
  id: 'doctor' | 'therapist' | 'front_desk' | 'pharmacist';
  tone: Tone;
  role: Role;
  values: Pick<UserFormValues, 'workingDays' | 'startsAt' | 'endsAt' | 'commissionPct'>;
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
    role: 'doctor',
    values: {
      workingDays: [...MON_SAT],
      startsAt: '10:00',
      endsAt: '19:00',
      commissionPct: 10,
    },
  },
  {
    id: 'therapist',
    tone: 'butter',
    role: 'therapist',
    values: {
      workingDays: [...MON_SAT],
      startsAt: '10:00',
      endsAt: '19:00',
      commissionPct: 5,
    },
  },
  {
    id: 'front_desk',
    tone: 'mint',
    role: 'front_desk',
    values: {
      workingDays: [...MON_SAT],
      startsAt: '09:30',
      endsAt: '19:30',
      commissionPct: 0,
    },
  },
  {
    id: 'pharmacist',
    tone: 'blush',
    role: 'pharmacist',
    values: {
      workingDays: [...EVERY_DAY],
      startsAt: '09:00',
      endsAt: '21:00',
      commissionPct: 0,
    },
  },
];

/** A new user's working week until someone sets it (`users.md:362`): Mon–Sat 10:00–19:00. */
const NEW_USER_DEFAULTS = {
  tone: 'sky',
  workingDays: MON_SAT,
  startsAt: '10:00',
  endsAt: '19:00',
} as const satisfies Pick<UserFormValues, 'tone' | 'startsAt' | 'endsAt'> & {
  workingDays: readonly Weekday[];
};

/**
 * A new user's starting values (`users.md:362`): Front desk — the clinic's role of that preset,
 * when it has one — sky, Mon–Sat 10:00–19:00, 0%, on `branchId` (the header's branch, else the
 * main one).
 */
export function emptyUserForm(
  branchId: string | null,
  frontDeskRoleId: string | null,
): UserFormValues {
  return {
    name: '',
    phone: '',
    email: '',
    tone: NEW_USER_DEFAULTS.tone,
    roleIds: frontDeskRoleId ? [frontDeskRoleId] : [],
    branchIds: branchId ? [branchId] : [],
    workingDays: [...NEW_USER_DEFAULTS.workingDays],
    startsAt: NEW_USER_DEFAULTS.startsAt,
    endsAt: NEW_USER_DEFAULTS.endsAt,
    commissionPct: 0,
    active: true,
  };
}

/** A member's form: their membership's values as clinozy-be keeps them. */
export function userFormOf(member: TeamMember): UserFormValues {
  return {
    name: member.name,
    phone: member.phone ? appPhoneDigits(member.phone) : '',
    email: member.email,
    tone: member.tone,
    roleIds: [...member.roleIds],
    branchIds: [...member.branchIds],
    workingDays: [...member.workingDays],
    startsAt: member.startsAt,
    endsAt: member.endsAt,
    commissionPct: member.commissionPercent,
    active: member.status !== 'suspended',
  };
}

/** The required fields still empty: the Email of a new user. */
export function missingUserFields(values: UserFormValues): 'email'[] {
  return values.email.trim() ? [] : ['email'];
}

const EMAIL = z.email();

/** Whether an email reads as one — the contract's `string (email)` (§7.2). */
export function isUserEmail(value: string): boolean {
  return EMAIL.safeParse(value.trim()).success;
}

/** A filled mobile that is not ten digits (an empty one is fine). */
export function isMobileIncomplete(digits: string): boolean {
  return digits.length > 0 && toAppPhone(digits) === null;
}

/** The branches a save sends: with one open branch, that branch (`users.md:95`). */
const branchesOf = (values: UserFormValues, singleBranchId: string | null) =>
  singleBranchId ? [singleBranchId] : values.branchIds;

/** A new user's invitation (`POST …/memberships`): the email, the roles and their clinic details. */
export function userInviteOf(
  values: UserFormValues,
  singleBranchId: string | null,
): MemberInvite {
  return {
    email: values.email.trim(),
    roleIds: values.roleIds,
    phone: values.phone ? toAppPhone(values.phone) : null,
    tone: values.tone,
    branchIds: branchesOf(values, singleBranchId),
    workingDays: values.workingDays,
    workStartsAt: values.startsAt,
    workEndsAt: values.endsAt,
    commissionPercent: values.commissionPct,
  };
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/** The profile an edit changed: the mobile, the colour, the roles (never the owner's) and branches. */
function profileChange(
  member: TeamMember,
  values: UserFormValues,
  singleBranchId: string | null,
): MemberChange {
  const change: MemberChange = {};
  const phone = values.phone ? toAppPhone(values.phone) : null;
  if (phone !== member.phone) change.phone = phone;
  if (values.tone !== member.tone) change.tone = values.tone;
  if (!(member.isOwner || sameList(values.roleIds, member.roleIds))) {
    change.roleIds = values.roleIds;
  }
  const branchIds = branchesOf(values, singleBranchId);
  if (!sameSet(branchIds, member.branchIds)) change.branchIds = branchIds;
  return change;
}

/** The week and pay an edit changed: the days, the hours and the commission. */
function scheduleChange(member: TeamMember, values: UserFormValues): MemberChange {
  const change: MemberChange = {};
  if (!sameSet(values.workingDays, member.workingDays)) {
    change.workingDays = values.workingDays;
  }
  if (values.startsAt !== member.startsAt) change.workStartsAt = values.startsAt;
  if (values.endsAt !== member.endsAt) change.workEndsAt = values.endsAt;
  if (values.commissionPct !== member.commissionPercent) {
    change.commissionPercent = values.commissionPct;
  }
  return change;
}

/** The status an edit changed — never an invitation's, the owner's or your own. */
function statusChange(member: TeamMember, values: UserFormValues): MemberChange {
  const status = values.active ? 'active' : 'suspended';
  const changeable = member.status !== 'invited' && !(member.isOwner || member.isSelf);
  return changeable && status !== member.status ? { status } : {};
}

/**
 * What an edit sends (`PATCH …/memberships/:id`): only the fields that changed, with the read's
 * `updated_at`. The owner's roles and status and your own status are never sent — clinozy-be
 * refuses them (transfer ownership first). Null when nothing changed.
 */
export function userChangeOf(
  member: TeamMember,
  values: UserFormValues,
  singleBranchId: string | null,
): MemberChange | null {
  const change: MemberChange = {
    ...profileChange(member, values, singleBranchId),
    ...scheduleChange(member, values),
    ...statusChange(member, values),
  };
  if (Object.keys(change).length === 0) return null;
  return { ...change, expectedUpdatedAt: member.updatedAt };
}
