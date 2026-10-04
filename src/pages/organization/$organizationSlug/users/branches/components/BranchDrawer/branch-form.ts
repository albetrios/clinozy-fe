import { z } from 'zod';

import type {
  BranchInput,
  BranchTeamChange,
} from '@/shared/api/clinic/branches-contracts.ts';
import type { Branch, Tone, Weekday } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { clinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';

import {
  BRANCH_DEFAULT_FIELDS,
  BRANCH_DEFAULT_ROLES,
  type BranchDefaultRole,
} from '../../hooks/useBranchRows/index.ts';

/**
 * The branch drawer's form (KICKOFF §6.12 Branch drawer; `users.md:179–198`):
 * the branch, its address, contact and opening hours, and its people — the
 * Team (staff profile ids) and the four default people.
 */
export interface BranchFormValues {
  name: string;
  tone: Tone;
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
  /** Who works here — staff profile ids. */
  teamIds: string[];
  defaults: Record<BranchDefaultRole, string | null>;
}

/** The branch drawer's three steps (`users.md:281–288`), for every viewport. */
export type BranchDrawerStepId = 'place' | 'contact' | 'people';

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
  selfProfileId,
}: {
  branchCount: number;
  main: Pick<Branch, 'city' | 'state'> | null;
  selfProfileId: string | null;
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
    teamIds: selfProfileId ? [selfProfileId] : [],
    defaults: { ...NO_DEFAULTS },
  };
}

/** A branch's form: its values, its team the people working there now. */
export function branchFormOf(
  branch: Branch,
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
    phone: branch.phone ? clinicPhoneDigits(branch.phone) : '',
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

/** The required fields still empty, in the form's order: Name, then Address line 1. */
export function missingBranchFields(
  values: Pick<BranchFormValues, 'name' | 'addressLine1'>,
): ('name' | 'addressLine1')[] {
  const missing: ('name' | 'addressLine1')[] = [];
  if (!values.name.trim()) missing.push('name');
  if (!values.addressLine1.trim()) missing.push('addressLine1');
  return missing;
}

/** Which roles may be each default (`users.md:194–197`): Front desk takes Counsellors too. */
export const DEFAULT_ROLE_KEYS: Readonly<Record<BranchDefaultRole, readonly string[]>> = {
  doctor: ['doctor'],
  desk: ['front_desk', 'counsellor'],
  therapist: ['therapist'],
  pharmacist: ['pharmacist'],
};

/** The people a default may be: the team's members holding the role. */
export function defaultPool(
  role: BranchDefaultRole,
  team: readonly TeamMember[],
): TeamMember[] {
  return team.filter((member) =>
    member.roleKeys.some((key) => DEFAULT_ROLE_KEYS[role].includes(key)),
  );
}

const EMAIL = z.email();

/** Whether a filled email reads as one (an empty one is fine). */
export function isBranchEmailInvalid(value: string): boolean {
  const email = value.trim();
  return email.length > 0 && !EMAIL.safeParse(email).success;
}

/** A filled phone that is not ten digits (an empty one is fine). */
export function isBranchPhoneIncomplete(digits: string): boolean {
  return digits.length > 0 && toClinicPhone(digits) === null;
}

/**
 * What a save sends (`saveBranch`): the trimmed fields, the phone E.164 (or
 * `''`), the GSTIN upper-cased, a default only while that person is still on
 * the team with the role — and the Team change against who worked here.
 */
export function branchSaveOf(
  values: BranchFormValues,
  {
    team,
    before,
  }: {
    /** The picked team's members, to keep the defaults honest. */
    team: readonly TeamMember[];
    /** Who worked here when the drawer opened (none for a new branch). */
    before: readonly string[];
  },
): { input: BranchInput; team: BranchTeamChange } {
  const defaultOf = (role: BranchDefaultRole) => {
    const id = values.defaults[role];
    return id && defaultPool(role, team).some((member) => member.profile?.id === id)
      ? id
      : null;
  };
  const picked = new Set(values.teamIds);
  const was = new Set(before);
  return {
    input: {
      name: values.name.trim(),
      tone: values.tone,
      isMain: values.isMain,
      active: values.active,
      addressLine1: values.addressLine1.trim(),
      addressLine2: values.addressLine2.trim() || null,
      area: values.area.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      pin: values.pin,
      phone: (values.phone && toClinicPhone(values.phone)) || '',
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
    team: {
      add: values.teamIds.filter((id) => !was.has(id)),
      remove: before.filter((id) => !picked.has(id)),
    },
  };
}
