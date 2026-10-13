import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import { listMembers, listRoles } from '@/shared/api/organization-api.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';

import {
  compareTeamMembers,
  fetchAllMembers,
  fetchAllRoles,
  joinTeam,
  teamMemberMatchesFilters,
  teamMemberMatchesSearch,
  teamMemberOf,
} from './users-api.ts';
import type { TeamMember } from './users-contracts.ts';

vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  listMembers: vi.fn(),
  listRoles: vi.fn(),
}));

const DOCTOR = 'rol_doctor000000000000000';
const DESK = 'rol_desk00000000000000000';
const VESU = 'brn_vesu00000000000000000';

/** A membership as `listMembers` maps it. */
function membership(key: string, overrides: Partial<Member> = {}): Member {
  return {
    id: `mem_${key.padEnd(21, '0')}`,
    userId: `usr_${key}`,
    name: `${key} name`,
    email: `${key}@clinic.com`,
    status: 'active',
    roleIds: [DESK],
    roleId: DESK,
    isOwner: false,
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
    staffNumber: 1,
    phone: null,
    tone: 'sky',
    branchIds: [],
    workingDays: ['mon'],
    workStartsAt: '10:00',
    workEndsAt: '19:00',
    commissionPercent: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

const row = (key: string, overrides: Partial<Member> = {}): TeamMember =>
  teamMemberOf(membership(key, overrides), null);

beforeEach(() => {
  vi.mocked(listMembers).mockReset();
  vi.mocked(listRoles).mockReset();
});

describe('the reads', () => {
  it('reads every page of the roster, the largest page at a time', async () => {
    vi.mocked(listMembers)
      .mockResolvedValueOnce({ rows: [membership('a')], next: 'cur_2', hasMore: true })
      .mockResolvedValueOnce({ rows: [membership('b')], next: null, hasMore: false });
    expect((await fetchAllMembers()).map((member) => member.userId)).toEqual([
      'usr_a',
      'usr_b',
    ]);
    expect(listMembers).toHaveBeenNthCalledWith(1, { limit: 100 });
    expect(listMembers).toHaveBeenNthCalledWith(2, { limit: 100, after: 'cur_2' });
  });

  it('reads every role in creation order — the presets as provisioned, then the clinic’s own', async () => {
    const role = { id: DOCTOR, name: 'Doctor' } as RoleSummary;
    vi.mocked(listRoles).mockResolvedValue({ rows: [role], next: null, hasMore: false });
    expect(await fetchAllRoles()).toEqual([role]);
    expect(listRoles).toHaveBeenCalledWith({
      sort: 'created_at',
      order: 'asc',
      limit: 100,
    });
  });
});

describe('the Team', () => {
  it('makes a row of a membership: its number, initials, roles, branches and hours', () => {
    const member = teamMemberOf(
      membership('nisha', {
        name: 'Dr. Nisha Shah',
        staffNumber: 12,
        roleIds: [DOCTOR, DESK],
        branchIds: [VESU],
        commissionPercent: 12.5,
      }),
      'usr_nisha',
    );
    expect(member).toMatchObject({
      membershipId: 'mem_nisha0000000000000000',
      name: 'Dr. Nisha Shah',
      initials: 'NS',
      seq: 12,
      roleIds: [DOCTOR, DESK],
      branchIds: [VESU],
      commissionPercent: 12.5,
      isSelf: true,
      joinedAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('keeps an invitation only on an invited row, and no join date until accepted', () => {
    const invitation = { id: 'inv_new', expiresAt: '2026-10-10T00:00:00.000Z' };
    expect(
      teamMemberOf(
        membership('new', { status: 'invited', joinedAt: '', invitation }),
        null,
      ),
    ).toMatchObject({ invitation, joinedAt: null, isSelf: false });
    expect(teamMemberOf(membership('old', { invitation }), null).invitation).toBeNull();
  });

  it('lists the newest #ID first', () => {
    const team = joinTeam([
      membership('a', { staffNumber: 3 }),
      membership('b', { staffNumber: 12 }),
      membership('c', { staffNumber: 7 }),
    ]);
    expect(team.map((member) => member.seq)).toEqual([12, 7, 3]);
  });
});

describe('the Team, searched and filtered in place', () => {
  const nisha = row('nisha', {
    name: 'Dr. Nisha Shah',
    email: 'nisha@clinic.com',
    phone: '+919876543210',
    staffNumber: 12,
    roleIds: [DOCTOR],
    branchIds: [VESU],
    createdAt: '2026-09-30T05:00:00.000Z',
  });

  it('finds a member by name, email, mobile or "#12"', () => {
    for (const query of ['nisha', 'CLINIC.COM', '98765', '#12', '']) {
      expect(teamMemberMatchesSearch(nisha, query)).toBe(true);
    }
    expect(teamMemberMatchesSearch(nisha, 'reenal')).toBe(false);
  });

  it('filters by a role held, a branch, a status and when they were added', () => {
    const today = '2026-10-03';
    expect(teamMemberMatchesFilters(nisha, { role: DOCTOR }, today)).toBe(true);
    expect(teamMemberMatchesFilters(nisha, { role: DESK }, today)).toBe(false);
    expect(teamMemberMatchesFilters(nisha, { branch: [VESU] }, today)).toBe(true);
    expect(teamMemberMatchesFilters(nisha, { branch: ['brn_other'] }, today)).toBe(false);
    expect(teamMemberMatchesFilters(nisha, { status: ['active'] }, today)).toBe(true);
    expect(teamMemberMatchesFilters(nisha, { status: ['inactive'] }, today)).toBe(false);
    expect(teamMemberMatchesFilters(nisha, { created: 'last_7' }, today)).toBe(true);
    const invited = row('new', { status: 'invited' });
    expect(
      teamMemberMatchesFilters(invited, { status: ['active', 'inactive'] }, today),
    ).toBe(false);
  });
});

describe('compareTeamMembers', () => {
  const a = row('a', {
    name: 'Asha',
    staffNumber: 2,
    roleIds: [DOCTOR],
    commissionPercent: 5,
  });
  const b = row('b', {
    name: 'Bina',
    staffNumber: 9,
    roleIds: [DESK],
    commissionPercent: 0,
  });
  const nobody = row('c', { name: 'Chetan', staffNumber: 4, roleIds: [] });
  const names = { [DOCTOR]: 'Doctor', [DESK]: 'Front desk' } as Record<string, string>;
  const sorted = (
    members: TeamMember[],
    ...args: Parameters<typeof compareTeamMembers>
  ) => [...members].sort(compareTeamMembers(...args)).map((member) => member.name);

  it('sorts by number, name and commission, either way', () => {
    expect(sorted([a, b], 'seq', 'desc')).toEqual(['Bina', 'Asha']);
    expect(sorted([b, a], 'name', 'asc')).toEqual(['Asha', 'Bina']);
    expect(sorted([b, a], 'commission', 'desc')).toEqual(['Asha', 'Bina']);
  });

  it('sorts by the main role’s name, a member with no role last either way', () => {
    const roleName = (id: string) => names[id] ?? id;
    expect(sorted([nobody, b, a], 'role', 'asc', roleName)).toEqual([
      'Asha',
      'Bina',
      'Chetan',
    ]);
    expect(sorted([nobody, a, b], 'role', 'desc', roleName)).toEqual([
      'Bina',
      'Asha',
      'Chetan',
    ]);
  });
});
