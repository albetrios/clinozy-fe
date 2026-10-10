import { describe, expect, it } from 'vitest';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { clinicBranch, TEST_BRANCH_ID } from '@/tests/utils/branch-doubles.ts';

import { branchRowOf, teamMemberById } from './useBranchRows.ts';

function teamMember(key: string, overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: `mem_${key}`,
    name: key,
    status: 'active',
    branchIds: [TEST_BRANCH_ID],
    ...overrides,
  } as unknown as TeamMember;
}

const branch = clinicBranch({
  defaultDoctorId: 'mem_nisha',
  defaultDeskId: 'mem_gone',
  defaultPharmacistId: 'mem_farah',
});

describe('branchRowOf', () => {
  it('counts the active people who work there', () => {
    const row = branchRowOf(branch, [
      teamMember('riya'),
      teamMember('samya', { status: 'suspended' }),
      teamMember('new', { status: 'invited' }),
      teamMember('elsewhere', { branchIds: ['brn_other'] }),
    ]);
    expect(row.team.map((member) => member.name)).toEqual(['riya']);
  });

  it('keeps the default people the Team has, in Doctor · Desk · Therapist · Pharmacy order', () => {
    const row = branchRowOf(branch, [teamMember('farah'), teamMember('nisha')]);
    expect(row.defaults.map(({ role, member }) => [role, member.name])).toEqual([
      ['doctor', 'nisha'],
      ['pharmacist', 'farah'],
    ]);
  });

  it('finds a Team member by membership id', () => {
    const find = teamMemberById([teamMember('riya')]);
    expect(find('mem_riya')?.name).toBe('riya');
    expect(find('mem_gone')).toBeUndefined();
    expect(find(null)).toBeUndefined();
  });
});
