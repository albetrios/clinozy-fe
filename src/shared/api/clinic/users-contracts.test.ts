import { describe, expect, it } from 'vitest';

import {
  splitStaffName,
  STAFF_PROFILE_DEFAULTS,
  staffInitials,
  staffProfileInputSchema,
} from './users-contracts.ts';

describe('the Name field (Appendix F: first and last names without breaking "Dr.")', () => {
  it.each<[string, string, string | null]>([
    ['Dr. Nisha Mavani', 'Dr. Nisha', 'Mavani'],
    ['Riya Shah', 'Riya', 'Shah'],
    ['Riya', 'Riya', null],
    ['Dr. Nisha', 'Dr. Nisha', null],
    ['Dr Drashti Moradiya', 'Dr Drashti', 'Moradiya'],
    ['  Admin   Cresence  Skin ', 'Admin Cresence', 'Skin'],
    ['', '', null],
  ])('splits "%s" into "%s" · %s', (name, firstName, lastName) => {
    expect(splitStaffName(name)).toEqual({ firstName, lastName });
  });

  it.each<[string, string]>([
    ['Riya Shah', 'RS'],
    ['Dr. Reenal Chaniyara', 'RC'],
    ['Dr Drashti Moradiya', 'DM'],
    ['Admin Cresence Skin', 'AS'],
    ['nidhi', 'N'],
    ['Drishti Patel', 'DP'],
    ['k.mehta@clinic.com', 'K'],
  ])('makes the Team’s initials of "%s": %s (usIni, H:3607)', (name, initials) => {
    expect(staffInitials(name)).toBe(initials);
  });
});

describe('a profile save', () => {
  const valid = {
    ...STAFF_PROFILE_DEFAULTS,
    membershipId: 'mbr_one',
    name: 'Riya Shah',
    email: 'riya@clinic.com',
  };

  it('starts a new user as Front desk, sky, Mon–Sat 10:00–19:00, 0%, Active (users.md:362)', () => {
    expect(staffProfileInputSchema.parse(valid)).toMatchObject({
      roleKeys: ['front_desk'],
      tone: 'sky',
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      startsAt: '10:00',
      endsAt: '19:00',
      commissionPct: 0,
      active: true,
    });
  });

  it('takes a custom role among the roles, at most seven', () => {
    const custom = 'rol_abcdefghijklmnopqrstu';
    expect(
      staffProfileInputSchema.safeParse({ ...valid, roleKeys: [custom, 'admin'] })
        .success,
    ).toBe(true);
    expect(
      staffProfileInputSchema.safeParse({
        ...valid,
        roleKeys: [
          'admin',
          'doctor',
          'therapist',
          'front_desk',
          'counsellor',
          'pharmacist',
          'accountant',
          'marketing',
        ],
      }).success,
    ).toBe(false);
  });

  it('wants the To after the From, and a name of at most 60 characters', () => {
    expect(
      staffProfileInputSchema.safeParse({ ...valid, startsAt: '10:00', endsAt: '10:00' })
        .success,
    ).toBe(false);
    expect(
      staffProfileInputSchema.safeParse({ ...valid, name: 'x'.repeat(61) }).success,
    ).toBe(false);
  });
});
