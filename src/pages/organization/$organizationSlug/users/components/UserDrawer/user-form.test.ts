import { describe, expect, it } from 'vitest';

import type { StaffProfile, TeamMember } from '@/shared/api/clinic/users-contracts.ts';

import {
  emptyUserForm,
  isMobileIncomplete,
  isUserEmail,
  missingUserFields,
  nextClockTime,
  USER_QUICK_FILLS,
  userFormOf,
  userProfileInput,
} from './user-form.ts';

const BRANCH = '7d3f5a8e-1b2c-4d5e-8f90-123456789abc';
const OTHER = '9a8b7c6d-1b2c-4d5e-8f90-123456789abc';

function teamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: 'mbr_reenal',
    userId: 'usr_reenal',
    email: 'reenal@cresence.skin',
    status: 'active',
    invitation: null,
    platformRoleId: 'rol_member',
    platformRoleName: 'Member',
    joinedAt: '2026-09-01T10:00:00.000Z',
    isOwner: false,
    isSelf: false,
    name: 'Dr. Reenal Chaniyara',
    initials: 'RC',
    tone: 'lav',
    roleKeys: ['doctor'],
    seq: 11,
    phone: '+919328790051',
    branchIds: [BRANCH],
    presence: 'away',
    lastActiveAt: null,
    profile: null,
    ...overrides,
  };
}

describe('the user drawer’s form (users.md:99–124)', () => {
  it('starts a new user as Front desk, sky, Mon–Sat 10:00–19:00, 0%, Active, on the branch given', () => {
    expect(emptyUserForm(BRANCH)).toEqual({
      name: '',
      phone: '',
      email: '',
      tone: 'sky',
      roleKeys: ['front_desk'],
      branchIds: [BRANCH],
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      startsAt: '10:00',
      endsAt: '19:00',
      commissionPct: 0,
      active: true,
    });
    expect(emptyUserForm(null).branchIds).toEqual([]);
  });

  it('reads a member’s profile — the mobile as digits, Owner never among the roles', () => {
    const profile = {
      roleKeys: ['doctor', 'owner'],
      branchIds: [BRANCH, OTHER],
      workingDays: ['mon', 'wed'],
      startsAt: '11:00',
      endsAt: '18:00',
      commissionPct: 12,
    } as unknown as StaffProfile;
    const form = userFormOf(teamMember({ profile, status: 'suspended' }));
    expect(form).toMatchObject({
      name: 'Dr. Reenal Chaniyara',
      phone: '9328790051',
      email: 'reenal@cresence.skin',
      tone: 'lav',
      roleKeys: ['doctor'],
      branchIds: [BRANCH, OTHER],
      workingDays: ['mon', 'wed'],
      startsAt: '11:00',
      endsAt: '18:00',
      commissionPct: 12,
      active: false,
    });
  });

  it('leaves the name empty for a member known only by email, with the starting roles', () => {
    const form = userFormOf(
      teamMember({
        name: 'new@clinic.com',
        email: 'new@clinic.com',
        roleKeys: [],
        phone: null,
      }),
    );
    expect(form.name).toBe('');
    expect(form.phone).toBe('');
    expect(form.roleKeys).toEqual(['front_desk']);
  });

  it('names the required fields still empty, Name then Email', () => {
    expect(missingUserFields(emptyUserForm(null))).toEqual(['name', 'email']);
    expect(
      missingUserFields({ ...emptyUserForm(null), name: ' Riya ', email: '' }),
    ).toEqual(['email']);
  });

  it('checks the email reads as one and a filled mobile has ten digits', () => {
    expect(isUserEmail('riya@clinic.com')).toBe(true);
    expect(isUserEmail('riya-at-clinic')).toBe(false);
    expect(isMobileIncomplete('')).toBe(false);
    expect(isMobileIncomplete('98250')).toBe(true);
    expect(isMobileIncomplete('9825044120')).toBe(false);
  });

  it('offers To only after From', () => {
    expect(nextClockTime('10:00')).toBe('10:30');
    expect(nextClockTime('23:30')).toBe('23:59');
  });

  it('presets roles, days, hours and commission — never the colour', () => {
    for (const fill of USER_QUICK_FILLS) {
      expect(Object.keys(fill.values).sort()).toEqual([
        'commissionPct',
        'endsAt',
        'roleKeys',
        'startsAt',
        'workingDays',
      ]);
    }
    expect(USER_QUICK_FILLS.map((fill) => fill.id)).toEqual([
      'doctor',
      'therapist',
      'front_desk',
      'pharmacist',
    ]);
    expect(USER_QUICK_FILLS[3]?.values.workingDays).toHaveLength(7);
  });

  it('saves the profile trimmed, the mobile E.164 — on the one open branch when there is one', () => {
    const values = {
      ...emptyUserForm(BRANCH),
      name: ' Dr. Ishita Rao ',
      email: ' ishita@clinic.com ',
      phone: '9876543210',
    };
    expect(userProfileInput(values, 'mbr_new', null)).toMatchObject({
      membershipId: 'mbr_new',
      name: 'Dr. Ishita Rao',
      email: 'ishita@clinic.com',
      phone: '+919876543210',
      branchIds: [BRANCH],
      commissionPct: 0,
    });
    expect(userProfileInput(values, 'mbr_new', OTHER).branchIds).toEqual([OTHER]);
  });
});
