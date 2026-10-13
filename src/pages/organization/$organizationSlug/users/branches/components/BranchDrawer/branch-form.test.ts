import { describe, expect, it } from 'vitest';

import type { Role } from '@/shared/api/app/app-schema.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { appBranch } from '@/tests/utils/branch-doubles.ts';

import {
  branchFormOf,
  branchSaveOf,
  defaultPool,
  emptyBranchForm,
  isBranchEmailInvalid,
  isBranchPhoneIncomplete,
  isBranchPinIncomplete,
  missingContactFields,
  missingPlaceFields,
  newBranchTone,
} from './branch-form.ts';

const DOCTOR = 'mem_doctor000000000000000';
const DESK = 'mem_desk00000000000000000';
const ROLE_OF: Record<string, Role> = {
  rol_doctor: 'doctor',
  rol_desk: 'front_desk',
  rol_counsellor: 'counsellor',
};
const presetOf = (roleId: string) => ROLE_OF[roleId] ?? null;

/** A Team member holding these roles. */
function person(membershipId: string, roleIds: string[]): TeamMember {
  return { membershipId, roleIds } as unknown as TeamMember;
}

const VESU = appBranch({
  phone: '+917490020098',
  workingDays: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  defaultDoctorId: DOCTOR,
});

describe('the branch form', () => {
  it('starts a new branch not main, Open, Mon–Sat 10:00–19:00, in the next tone, with you', () => {
    const form = emptyBranchForm({
      branchCount: 3,
      main: { city: 'Surat', state: 'Gujarat' },
      selfMembershipId: DESK,
    });
    expect(form).toMatchObject({
      tone: 'peach',
      isMain: false,
      active: true,
      city: 'Surat',
      state: 'Gujarat',
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      opensAt: '10:00',
      closesAt: '19:00',
      teamIds: [DESK],
    });
    expect(
      emptyBranchForm({ branchCount: 0, main: null, selfMembershipId: null }),
    ).toMatchObject({ tone: 'mint', city: '', teamIds: [] });
    expect([0, 1, 2, 3, 4, 5].map(newBranchTone)).toEqual([
      'mint',
      'lav',
      'blush',
      'peach',
      'plum',
      'mint',
    ]);
  });

  it('reads a branch into the form: the phone’s digits, its defaults by role', () => {
    expect(branchFormOf(VESU, [DOCTOR])).toMatchObject({
      name: 'Vesu',
      phone: '7490020098',
      addressLine2: '',
      gstNumber: '',
      teamIds: [DOCTOR],
      defaults: { doctor: DOCTOR, desk: null, therapist: null, pharmacist: null },
    });
  });

  it('names the required fields still empty — step 1’s, then Phone and Email', () => {
    expect(
      missingPlaceFields({ name: ' ', addressLine1: '', area: '', city: '', pin: '' }),
    ).toEqual(['name', 'addressLine1', 'area', 'city', 'pin']);
    expect(missingPlaceFields(branchFormOf(VESU, []))).toEqual([]);
    expect(missingContactFields({ phone: '', email: ' ' })).toEqual(['phone', 'email']);
    expect(missingContactFields(branchFormOf(VESU, []))).toEqual([]);
  });

  it('offers a default only the team’s people holding its preset — Front desk takes Counsellors', () => {
    const team = [person(DOCTOR, ['rol_doctor']), person(DESK, ['rol_counsellor'])];
    const pool = (role: Parameters<typeof defaultPool>[0]) =>
      defaultPool(role, team, presetOf).map((member) => member.membershipId);
    expect(pool('doctor')).toEqual([DOCTOR]);
    expect(pool('desk')).toEqual([DESK]);
    expect(pool('pharmacist')).toEqual([]);
  });

  it('checks a filled PIN code, phone and email — an empty one is a missing field', () => {
    expect(isBranchPinIncomplete('')).toBe(false);
    expect(isBranchPinIncomplete('3950')).toBe(true);
    expect(isBranchPinIncomplete('395007')).toBe(false);
    expect(isBranchPhoneIncomplete('')).toBe(false);
    expect(isBranchPhoneIncomplete('98250')).toBe(true);
    expect(isBranchPhoneIncomplete('9825044120')).toBe(false);
    expect(isBranchEmailInvalid('')).toBe(false);
    expect(isBranchEmailInvalid('vesu-at-clinic')).toBe(true);
    expect(isBranchEmailInvalid('vesu@clinic.com')).toBe(false);
  });

  it('sends the trimmed fields, a default only while its person is on the team, and the whole team', () => {
    const values = {
      ...branchFormOf(VESU, [DOCTOR]),
      name: ' Vesu ',
      gstNumber: '24aakfc4821m2z5',
      teamIds: [DESK],
      defaults: { doctor: DOCTOR, desk: DESK, therapist: null, pharmacist: null },
    };
    const save = branchSaveOf(values, {
      team: [person(DESK, ['rol_desk'])],
      presetOf,
    });
    expect(save.input).toMatchObject({
      name: 'Vesu',
      phone: '+917490020098',
      addressLine2: null,
      gstNumber: '24AAKFC4821M2Z5',
      defaultDoctorId: null,
      defaultDeskId: DESK,
    });
    expect(save.input).not.toHaveProperty('isMain');
    expect(save.memberIds).toEqual([DESK]);
  });
});
