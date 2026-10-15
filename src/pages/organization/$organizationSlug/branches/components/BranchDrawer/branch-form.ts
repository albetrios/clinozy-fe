import { z } from 'zod';

import type { Role, Tone, Weekday } from '@/shared/api/app/app-schema.ts';
import type { AppBranch, BranchSave } from '@/shared/api/app/branches-contracts.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';
import { appPhoneDigits } from '@/shared/app/app-phone-field.ts';

import {
  BRANCH_DEFAULT_FIELDS,
  BRANCH_DEFAULT_ROLES,
  type BranchDefaultRole,
} from '../../hooks/useBranchRows/index.ts';

/**
 * The branch drawer's form (KICKOFF §6.12 Branch drawer; `users.md:179–198`):
 * the branch, its address, contact and opening hours, and its people — the
 * Team (membership ids) and the four default people.
 */
export interface BranchFormValues {
  name: string;
  tone: Tone;
  /** Read-only: the clinic's main branch is set when it is provisioned. */
  isMain: boolean;
  active: boolean;
  addressLine1: string;
  addressLine2: string;
  area: string;
  city: string;
  pin: string;
  state: string;
  /** The phone's digits, at most ten (`DrawerPhoneInput`). */
  phone: string;
  email: string;
  gstNumber: string;
  workingDays: Weekday[];
  opensAt: string;
  closesAt: string;
  /** Who works here — membership ids. */
  teamIds: string[];
  defaults: Record<BranchDefaultRole, string | null>;
}

/**
 * The branch drawer's steps (`users.md:281–288`), for every viewport: three, and on an existing
 * branch a fourth, "Places & days" (D23).
 */
export type BranchDrawerStepId = 'place' | 'contact' | 'people' | 'places';

/** The Colour field's swatches, in the design's order (`users.md:180`). */
export const BRANCH_TONES = [
  'sage',
  'sky',
  'butter',
  'lav',
  'blush',
  'mint',
  'peach',
  'plum',
  'lime',
] as const satisfies readonly Tone[];

/** A new branch's tone: the next of mint · lav · blush · peach · plum by branch count (H:5197). */
const NEW_BRANCH_TONES = ['mint', 'lav', 'blush', 'peach', 'plum'] as const;

/** The tone a new branch starts with, given how many branches there are. */
export function newBranchTone(branchCount: number): Tone {
  return NEW_BRANCH_TONES[branchCount % NEW_BRANCH_TONES.length] ?? 'mint';
}

const MON_SAT: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const NO_DEFAULTS: Record<BranchDefaultRole, null> = {
  doctor: null,
  desk: null,
  therapist: null,
  pharmacist: null,
};

/**
 * A new branch's starting values (`users.md:179–198`; H:5197): not main, Open,
 * Mon–Sat 10:00–19:00, the next tone, City and State copied from the main
 * branch (the prototype hard-codes "Surat" / "Gujarat", D15), you on its team
 * and nobody by default.
 */
export function emptyBranchForm({
  branchCount,
  main,
  selfMembershipId,
}: {
  branchCount: number;
  main: Pick<AppBranch, 'city' | 'state'> | null;
  selfMembershipId: string | null;
}): BranchFormValues {
  return {
    name: '',
    tone: newBranchTone(branchCount),
    isMain: false,
    active: true,
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: main?.city ?? '',
    pin: '',
    state: main?.state ?? '',
    phone: '',
    email: '',
    gstNumber: '',
    workingDays: [...MON_SAT],
    opensAt: '10:00',
    closesAt: '19:00',
    teamIds: selfMembershipId ? [selfMembershipId] : [],
    defaults: { ...NO_DEFAULTS },
  };
}

/** A branch's form: its values, its team the people working there now. */
export function branchFormOf(
  branch: AppBranch,
  teamIds: readonly string[],
): BranchFormValues {
  return {
    name: branch.name,
    tone: branch.tone,
    isMain: branch.isMain,
    active: branch.active,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2 ?? '',
    area: branch.area,
    city: branch.city,
    pin: branch.pin,
    state: branch.state,
    phone: branch.phone ? appPhoneDigits(branch.phone) : '',
    email: branch.email,
    gstNumber: branch.gstNumber ?? '',
    workingDays: [...branch.workingDays],
    opensAt: branch.opensAt,
    closesAt: branch.closesAt,
    teamIds: [...teamIds],
    defaults: Object.fromEntries(
      BRANCH_DEFAULT_ROLES.map((role) => [role, branch[BRANCH_DEFAULT_FIELDS[role]]]),
    ) as Record<BranchDefaultRole, string | null>,
  };
}

/** A field the branch can't be saved without (clinozy-be's create requires each). */
export type RequiredBranchField =
  'name' | 'addressLine1' | 'area' | 'city' | 'pin' | 'phone' | 'email';

/** Step 1's required fields still empty, in the form's order: Name, the address, Area, City, PIN. */
export function missingPlaceFields(
  values: Pick<BranchFormValues, 'name' | 'addressLine1' | 'area' | 'city' | 'pin'>,
): RequiredBranchField[] {
  const missing: RequiredBranchField[] = [];
  if (!values.name.trim()) missing.push('name');
  if (!values.addressLine1.trim()) missing.push('addressLine1');
  if (!values.area.trim()) missing.push('area');
  if (!values.city.trim()) missing.push('city');
  if (!values.pin) missing.push('pin');
  return missing;
}

/** Step 2's required fields still empty: Phone, then Email. */
export function missingContactFields(
  values: Pick<BranchFormValues, 'phone' | 'email'>,
): RequiredBranchField[] {
  const missing: RequiredBranchField[] = [];
  if (!values.phone) missing.push('phone');
  if (!values.email.trim()) missing.push('email');
  return missing;
}

/** Which presets may be each default (`users.md:194–197`): Front desk takes Counsellors too. */
const DEFAULT_PRESETS: Readonly<Record<BranchDefaultRole, readonly Role[]>> = {
  doctor: ['doctor'],
  desk: ['front_desk', 'counsellor'],
  therapist: ['therapist'],
  pharmacist: ['pharmacist'],
};

/** The people a default may be: the team's members holding one of the role's presets. */
export function defaultPool(
  role: BranchDefaultRole,
  team: readonly TeamMember[],
  presetOf: (roleId: string) => Role | null,
): TeamMember[] {
  return team.filter((member) =>
    member.roleIds.some((roleId) => {
      const preset = presetOf(roleId);
      return preset !== null && DEFAULT_PRESETS[role].includes(preset);
    }),
  );
}

const EMAIL = z.email();

/** Whether a filled email reads as one (an empty one is a missing field). */
export function isBranchEmailInvalid(value: string): boolean {
  const email = value.trim();
  return email.length > 0 && !EMAIL.safeParse(email).success;
}

/** A filled phone that is not ten digits (an empty one is a missing field). */
export function isBranchPhoneIncomplete(digits: string): boolean {
  return digits.length > 0 && toAppPhone(digits) === null;
}

/** A filled PIN code that is not six digits. */
export function isBranchPinIncomplete(pin: string): boolean {
  return pin.length > 0 && !/^\d{6}$/.test(pin);
}

/**
 * What a save sends (`saveBranch`): the trimmed fields, the phone E.164, the GSTIN upper-cased,
 * a default only while that person is on the team with the role — and the team, the whole set.
 */
export function branchSaveOf(
  values: BranchFormValues,
  {
    team,
    presetOf,
  }: {
    /** The picked team's members, to keep the defaults honest. */
    team: readonly TeamMember[];
    presetOf: (roleId: string) => Role | null;
  },
): Pick<BranchSave, 'input' | 'memberIds'> {
  const defaultOf = (role: BranchDefaultRole) => {
    const id = values.defaults[role];
    return id &&
      defaultPool(role, team, presetOf).some((member) => member.membershipId === id)
      ? id
      : null;
  };
  return {
    input: {
      name: values.name.trim(),
      tone: values.tone,
      active: values.active,
      addressLine1: values.addressLine1.trim(),
      addressLine2: values.addressLine2.trim() || null,
      area: values.area.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      pin: values.pin,
      phone: toAppPhone(values.phone) ?? '',
      email: values.email.trim(),
      gstNumber: values.gstNumber.trim().toUpperCase() || null,
      workingDays: values.workingDays,
      opensAt: values.opensAt,
      closesAt: values.closesAt,
      defaultDoctorId: defaultOf('doctor'),
      defaultDeskId: defaultOf('desk'),
      defaultTherapistId: defaultOf('therapist'),
      defaultPharmacistId: defaultOf('pharmacist'),
    },
    memberIds: [...values.teamIds],
  };
}
