import { describe, expect, it } from 'vitest';

import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';

import { branchRowOf, teamMemberByProfileId } from './useBranchRows.ts';

const BRANCH = 'b-adajan';

function teamMember(
  key: string,
  overrides: Partial<TeamMember> & { profileId?: string | null } = {},
): TeamMember {
  const { profileId = `p-${key}`, ...rest } = overrides;
  return {
    membershipId: `mbr_${key}`,
    name: key,
    status: 'active',
    branchIds: [BRANCH],
    profile: profileId ? { id: profileId } : null,
    ...rest,
  } as unknown as TeamMember;
}

const branch = {
  id: BRANCH,
  defaultDoctorId: 'p-nisha',
  defaultDeskId: 'p-gone',
  defaultTherapistId: null,
  defaultPharmacistId: 'p-farah',
} as unknown as Branch;

describe('branchRowOf', () => {
  it('counts the active people with a profile who work there', () => {
    const row = branchRowOf(branch, [
      teamMember('riya'),
      teamMember('samya', { status: 'suspended' }),
      teamMember('new', { status: 'invited' }),
      teamMember('vesu-only', { branchIds: ['b-vesu'] }),
      teamMember('no-profile', { profileId: null }),
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

  it('finds a Team member by staff profile id', () => {
    const find = teamMemberByProfileId([teamMember('riya')]);
    expect(find('p-riya')?.name).toBe('riya');
    expect(find('p-gone')).toBeUndefined();
    expect(find(null)).toBeUndefined();
  });
});
