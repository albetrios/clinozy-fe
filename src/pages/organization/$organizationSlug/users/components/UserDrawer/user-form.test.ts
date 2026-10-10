import { describe, expect, it } from 'vitest';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';

import {
  emptyUserForm,
  isMobileIncomplete,
  isUserEmail,
  missingUserFields,
  USER_QUICK_FILLS,
  userChangeOf,
  userFormOf,
  userInviteOf,
} from './user-form.ts';

const DESK = 'rol_desk00000000000000000';
const DOCTOR = 'rol_doctor000000000000000';
const VESU = 'brn_vesu00000000000000000';
const ADAJAN = 'brn_adajan000000000000000';

/** A Team row: Riya, Front desk at Vesu, Mon–Sat 10:00–19:00. */
function teamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: 'mem_riya00000000000000000',
    userId: 'usr_riya',
    email: 'riya@cresence.skin',
    status: 'active',
    invitation: null,
    joinedAt: '2026-09-01T10:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-05T10:00:00.000Z',
    isOwner: false,
    isSelf: false,
    name: 'Riya Shah',
    initials: 'RS',
    tone: 'mint',
    roleIds: [DESK],
    seq: 12,
    phone: '+919825044120',
    branchIds: [VESU],
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    startsAt: '10:00',
    endsAt: '19:00',
    commissionPercent: 2.5,
    ...overrides,
  };
}

describe('the user drawer’s form (users.md:99–124)', () => {
  it('starts a new user as Front desk, sky, Mon–Sat 10:00–19:00, 0%, Active, on the branch given', () => {
    expect(emptyUserForm(VESU, DESK)).toEqual({
      name: '',
      phone: '',
      email: '',
      tone: 'sky',
      roleIds: [DESK],
      branchIds: [VESU],
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      startsAt: '10:00',
      endsAt: '19:00',
      commissionPct: 0,
      active: true,
    });
    // A clinic with no Front desk left starts with no role.
    expect(emptyUserForm(null, null)).toMatchObject({ roleIds: [], branchIds: [] });
  });

  it('reads a membership — the mobile as digits, a suspended member Inactive', () => {
    expect(userFormOf(teamMember({ status: 'suspended' }))).toMatchObject({
      name: 'Riya Shah',
      phone: '9825044120',
      roleIds: [DESK],
      branchIds: [VESU],
      commissionPct: 2.5,
      active: false,
    });
  });

  it('needs an Email, which reads as one, and a filled mobile of ten digits', () => {
    expect(missingUserFields(emptyUserForm(null, DESK))).toEqual(['email']);
    expect(missingUserFields(userFormOf(teamMember()))).toEqual([]);
    expect(isUserEmail(' riya@cresence.skin ')).toBe(true);
    expect(isUserEmail('riya')).toBe(false);
    expect(isMobileIncomplete('')).toBe(false);
    expect(isMobileIncomplete('98250')).toBe(true);
    expect(isMobileIncomplete('9825044120')).toBe(false);
  });

  it('offers Quick fills by preset — the role is the clinic’s own role of that name', () => {
    expect(USER_QUICK_FILLS.map((fill) => [fill.id, fill.role])).toEqual([
      ['doctor', 'doctor'],
      ['therapist', 'therapist'],
      ['front_desk', 'front_desk'],
      ['pharmacist', 'pharmacist'],
    ]);
  });

  it('invites with the email, the roles and the clinic details — on the one open branch when there is one', () => {
    const values = {
      ...emptyUserForm(VESU, DESK),
      email: ' ishita@clinic.com ',
      phone: '9825044120',
      roleIds: [DOCTOR, DESK],
      branchIds: [VESU, ADAJAN],
    };
    expect(userInviteOf(values, null)).toEqual({
      email: 'ishita@clinic.com',
      roleIds: [DOCTOR, DESK],
      phone: '+919825044120',
      tone: 'sky',
      branchIds: [VESU, ADAJAN],
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      workStartsAt: '10:00',
      workEndsAt: '19:00',
      commissionPercent: 0,
    });
    expect(userInviteOf(values, VESU).branchIds).toEqual([VESU]);
  });
});

describe('userChangeOf', () => {
  it('sends only what changed, with the read’s updated_at', () => {
    const member = teamMember();
    expect(userChangeOf(member, userFormOf(member), null)).toBeNull();
    expect(
      userChangeOf(
        member,
        {
          ...userFormOf(member),
          roleIds: [DOCTOR, DESK],
          commissionPct: 10,
          active: false,
        },
        null,
      ),
    ).toEqual({
      roleIds: [DOCTOR, DESK],
      commissionPercent: 10,
      status: 'suspended',
      expectedUpdatedAt: member.updatedAt,
    });
  });

  it('never sends the owner’s roles or status, nor your own status', () => {
    const owner = teamMember({ isOwner: true });
    expect(
      userChangeOf(
        owner,
        { ...userFormOf(owner), roleIds: [DOCTOR], active: false },
        null,
      ),
    ).toBeNull();
    const self = teamMember({ isSelf: true });
    expect(userChangeOf(self, { ...userFormOf(self), active: false }, null)).toBeNull();
  });

  it('sends no status for an invitation, and the branches as a set', () => {
    const invited = teamMember({ status: 'invited', branchIds: [VESU, ADAJAN] });
    expect(
      userChangeOf(
        invited,
        { ...userFormOf(invited), active: false, branchIds: [ADAJAN, VESU] },
        null,
      ),
    ).toBeNull();
  });
});
