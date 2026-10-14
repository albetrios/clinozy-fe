import { z } from 'zod';

import type { Weekday } from '@/shared/api/app/app-schema.ts';
import { BRANCH_LIMITS, type BranchInput } from '@/shared/api/app/branches-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';
import { PIN_CODE_PATTERN } from '@/shared/app/pin-directory/index.ts';

/*
 * Step 2, "Where is your clinic?" (KICKOFF §6.1; BRIEF.md:59–64): the fields the branch create
 * requires — PIN, address line, area, city, state, phone, email, branch name — and the hours on one
 * line. The first branch becomes the clinic's main branch on the server (RC-4).
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
export type LocationProblem = 'required' | 'pin' | 'email' | 'phone' | 'hours';

const EMAIL = z.email();

/**
 * The step's problems by field — a required field empty, a PIN that is not six digits, an email or
 * phone that does not read as one, hours that close before they open. Empty when it can be saved.
 */
export function locationProblems(
  values: LocationFormValues,
): Partial<Record<LocationField | 'closesAt', LocationProblem>> {
  const problems: Partial<Record<LocationField | 'closesAt', LocationProblem>> = {};
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
  if (values.closesAt <= values.opensAt) problems.closesAt = 'hours';
  return problems;
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
    workingDays: values.workingDays,
    opensAt: values.opensAt,
    closesAt: values.closesAt,
    defaultDoctorId: null,
    defaultDeskId: null,
    defaultTherapistId: null,
    defaultPharmacistId: null,
  };
}
