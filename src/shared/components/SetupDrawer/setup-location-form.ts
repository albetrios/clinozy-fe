import { z } from 'zod';

import type { Weekday } from '@/shared/api/app/app-schema.ts';
import {
  type AppBranch,
  BRANCH_LIMITS,
  type BranchInput,
} from '@/shared/api/app/branches-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';
import { appPhoneDigits } from '@/shared/app/app-phone-field.ts';
import { PIN_CODE_PATTERN } from '@/shared/app/pin-directory/index.ts';

import type { LocationQuestion } from './setup-place.ts';

/*
 * Step 2, "Where is your clinic?" (KICKOFF §6.1; BRIEF.md:59–64): the fields the branch create
 * requires — PIN, address line, area, city, state, phone, email, branch name — and the hours. Asked
 * as three questions, one per screen (change-setup-one-question D1): the PIN, the street address
 * (area, city and state from the PIN), the phone. The branch name is the clinic's (D2), the email the
 * owner's and the hours the default — not asked. The first branch becomes the clinic's main branch
 * on the server (RC-4).
 */

/** The step's values; the phone is its ten digits (`DrawerPhoneInput`). */
export interface LocationFormValues {
  pin: string;
  area: string;
  city: string;
  state: string;
  addressLine: string;
  phone: string;
  email: string;
  name: string;
  workingDays: Weekday[];
  opensAt: string;
  closesAt: string;
}

/** The hours a new branch starts with (F18): Monday to Saturday, 10:00–20:00. */
export const SETUP_BRANCH_HOURS = {
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as Weekday[],
  opensAt: '10:00',
  closesAt: '20:00',
} as const;

/** The step's starting values: the clinic's name cut to 60 (F3), the owner's email. */
export function initialLocationForm({
  clinicName,
  email,
}: {
  clinicName: string;
  email: string;
}): LocationFormValues {
  return {
    pin: '',
    area: '',
    city: '',
    state: '',
    addressLine: '',
    phone: '',
    email,
    name: clinicName.trim().slice(0, BRANCH_LIMITS.name),
    workingDays: [...SETUP_BRANCH_HOURS.workingDays],
    opensAt: SETUP_BRANCH_HOURS.opensAt,
    closesAt: SETUP_BRANCH_HOURS.closesAt,
  };
}

/** The fields the step cannot be saved without, in the form's order. */
export type LocationField =
  'pin' | 'addressLine' | 'area' | 'city' | 'phone' | 'email' | 'name';

/** What is wrong with each field, as the step's error keys name it. */
export type LocationProblem = 'required' | 'pin' | 'email' | 'phone';

const EMAIL = z.email();

/**
 * The step's problems by field — a required field empty, a PIN that is not six digits, an email or
 * phone that does not read as one. Empty when it can be saved. The hours are not asked: the
 * default, or a saved branch's.
 */
export function locationProblems(
  values: LocationFormValues,
): Partial<Record<LocationField, LocationProblem>> {
  const problems: Partial<Record<LocationField, LocationProblem>> = {};
  const required: readonly LocationField[] = [
    'pin',
    'addressLine',
    'area',
    'city',
    'phone',
    'email',
    'name',
  ];
  for (const field of required) {
    if (!values[field].trim()) problems[field] = 'required';
  }
  if (problems.pin === undefined && !PIN_CODE_PATTERN.test(values.pin))
    problems.pin = 'pin';
  if (problems.email === undefined && !EMAIL.safeParse(values.email.trim()).success) {
    problems.email = 'email';
  }
  if (problems.phone === undefined && toAppPhone(values.phone) === null)
    problems.phone = 'phone';
  return problems;
}

/**
 * The fields each question answers. The phone's question also answers for the defaults it does not
 * show — the branch name and the email — so a default the server would refuse is named where the
 * branch is saved, never silently dropped.
 */
export const LOCATION_QUESTION_FIELDS: Record<
  LocationQuestion,
  readonly LocationField[]
> = {
  pin: ['pin'],
  address: ['addressLine', 'area', 'city'],
  phone: ['phone', 'email', 'name'],
};

/** The problems one question shows: {@link locationProblems} for its own fields only. */
export function locationQuestionProblems(
  values: LocationFormValues,
  question: LocationQuestion,
): Partial<Record<LocationField, LocationProblem>> {
  const all = locationProblems(values);
  return Object.fromEntries(
    LOCATION_QUESTION_FIELDS[question].flatMap((field) => {
      const problem = all[field];
      return problem === undefined ? [] : [[field, problem]];
    }),
  );
}

/**
 * A main branch read back into the step's answers — Back from "Do you see patients yourself?"
 * shows what was saved, and a change to it is saved to that branch (change-setup-one-question D6).
 */
export function locationFormFromBranch(branch: AppBranch): LocationFormValues {
  return {
    pin: branch.pin,
    area: branch.area,
    city: branch.city,
    state: branch.state,
    addressLine: branch.addressLine1,
    phone: branch.phone ? appPhoneDigits(branch.phone) : '',
    email: branch.email,
    name: branch.name,
    workingDays: [...branch.workingDays],
    opensAt: branch.opensAt,
    closesAt: branch.closesAt,
  };
}

/** A branch as an edit sends it back — every field as read, defaults included. */
export function branchInputOf(branch: AppBranch): BranchInput {
  return {
    name: branch.name,
    tone: branch.tone,
    active: branch.active,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2,
    area: branch.area,
    city: branch.city,
    state: branch.state,
    pin: branch.pin,
    phone: branch.phone,
    email: branch.email,
    gstNumber: branch.gstNumber,
    reviewLink: branch.reviewLink,
    workingDays: branch.workingDays,
    opensAt: branch.opensAt,
    closesAt: branch.closesAt,
    defaultDoctorId: branch.defaultDoctorId,
    defaultDeskId: branch.defaultDeskId,
    defaultTherapistId: branch.defaultTherapistId,
    defaultPharmacistId: branch.defaultPharmacistId,
  };
}

/**
 * A main branch with the step's answers laid over it — the place and the phone; its name, email,
 * hours, team and defaults stay as saved.
 */
export function locationBranchUpdate(
  branch: AppBranch,
  values: LocationFormValues,
): BranchInput {
  const created = locationBranchInput(values);
  return {
    ...branchInputOf(branch),
    addressLine1: created.addressLine1,
    area: created.area,
    city: created.city,
    state: created.state,
    pin: created.pin,
    phone: created.phone,
  };
}

/** The branch create's fields; it names no team, so clinozy-be puts its creator on it (D13). */
export function locationBranchInput(values: LocationFormValues): BranchInput {
  return {
    name: values.name.trim(),
    tone: 'sage',
    active: true,
    addressLine1: values.addressLine.trim(),
    addressLine2: null,
    area: values.area.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    pin: values.pin,
    phone: toAppPhone(values.phone) ?? values.phone,
    email: values.email.trim(),
    gstNumber: null,
    reviewLink: null,
    workingDays: values.workingDays,
    opensAt: values.opensAt,
    closesAt: values.closesAt,
    defaultDoctorId: null,
    defaultDeskId: null,
    defaultTherapistId: null,
    defaultPharmacistId: null,
  };
}
