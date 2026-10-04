import { describe, expect, it } from 'vitest';

import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';

import {
  branchFormOf,
  branchSaveOf,
  defaultPool,
  emptyBranchForm,
  isBranchEmailInvalid,
  isBranchPhoneIncomplete,
  missingBranchFields,
  newBranchTone,
} from './branch-form.ts';

const PROFILE_DOCTOR = '00000000-0000-4000-8000-0000000d0c01';
const PROFILE_DESK = '00000000-0000-4000-8000-0000000de5c1';

/** A Team member holding `roleKeys`, on a profile with `profileId`. */
function person(profileId: string, roleKeys: string[]): TeamMember {
  return {
    membershipId: `mbr_${profileId}`,
    roleKeys,
    profile: { id: profileId },
  } as unknown as TeamMember;
}

const VESU = {
  id: '00000000-0000-4000-8000-00000000b002',
  name: 'Vesu',
  tone: 'sky',
  isMain: false,
  active: true,
  addressLine1: 'Shop 12, Rajhans Platinum',
  addressLine2: null,
  area: 'Vesu',
  city: 'Surat',
  state: 'Gujarat',
  pin: '395007',
  phone: '+917490020098',
  email: 'vesu@cresence.skin',
  gstNumber: null,
  opensAt: '11:00',
  closesAt: '20:00',
  workingDays: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  defaultDoctorId: PROFILE_DOCTOR,
  defaultDeskId: null,
  defaultTherapistId: null,
  defaultPharmacistId: null,
} as unknown as Branch;

describe('the branch form', () => {
  it('starts a new branch not main, Open, Mon–Sat 10:00–19:00, in the next tone, with you', () => {
    const form = emptyBranchForm({
      branchCount: 3,
      main: { city: 'Surat', state: 'Gujarat' },
      selfProfileId: PROFILE_DESK,
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
      teamIds: [PROFILE_DESK],
    });
    expect(
      emptyBranchForm({ branchCount: 0, main: null, selfProfileId: null }),
    ).toMatchObject({
      tone: 'mint',
      city: '',
      teamIds: [],
    });
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
    const form = branchFormOf(VESU, [PROFILE_DOCTOR]);
    expect(form).toMatchObject({
      name: 'Vesu',
      phone: '7490020098',
      addressLine2: '',
      gstNumber: '',
      teamIds: [PROFILE_DOCTOR],
      defaults: { doctor: PROFILE_DOCTOR, desk: null, therapist: null, pharmacist: null },
    });
  });

  it('names the required fields still empty: Name, then Address line 1', () => {
    expect(missingBranchFields({ name: ' ', addressLine1: '' })).toEqual([
      'name',
      'addressLine1',
    ]);
    expect(missingBranchFields({ name: 'Vesu', addressLine1: 'Shop 12' })).toEqual([]);
  });

  it('offers a default only the team’s people with the role — Front desk takes Counsellors', () => {
    const team = [
      person(PROFILE_DOCTOR, ['doctor']),
      person(PROFILE_DESK, ['counsellor']),
    ];
    expect(defaultPool('doctor', team).map((member) => member.profile?.id)).toEqual([
      PROFILE_DOCTOR,
    ]);
    expect(defaultPool('desk', team).map((member) => member.profile?.id)).toEqual([
      PROFILE_DESK,
    ]);
    expect(defaultPool('pharmacist', team)).toEqual([]);
  });

  it('checks a filled phone and email, never an empty one', () => {
    expect(isBranchPhoneIncomplete('')).toBe(false);
    expect(isBranchPhoneIncomplete('98250')).toBe(true);
    expect(isBranchPhoneIncomplete('9825044120')).toBe(false);
    expect(isBranchEmailInvalid('')).toBe(false);
    expect(isBranchEmailInvalid('vesu-at-clinic')).toBe(true);
    expect(isBranchEmailInvalid('vesu@clinic.com')).toBe(false);
  });

  it('sends the trimmed fields, a default only while its person is on the team, and the team change', () => {
    const values = {
      ...branchFormOf(VESU, [PROFILE_DOCTOR]),
      name: ' Vesu ',
      gstNumber: '24aakfc4821m2z5',
      teamIds: [PROFILE_DESK],
      defaults: {
        doctor: PROFILE_DOCTOR,
        desk: PROFILE_DESK,
        therapist: null,
        pharmacist: null,
      },
    };
    const save = branchSaveOf(values, {
      team: [person(PROFILE_DESK, ['front_desk'])],
      before: [PROFILE_DOCTOR],
    });
    expect(save.input).toMatchObject({
      name: 'Vesu',
      phone: '+917490020098',
      addressLine2: null,
      gstNumber: '24AAKFC4821M2Z5',
      defaultDoctorId: null,
      defaultDeskId: PROFILE_DESK,
    });
    expect(save.team).toEqual({ add: [PROFILE_DESK], remove: [PROFILE_DOCTOR] });
  });
});
