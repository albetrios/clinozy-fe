import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import { toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  type ClinicAccessMatrix,
  fetchClinicAccessMatrix,
  resetClinicAccessFixture,
  saveRoleMatrixChange,
} from './access-api.ts';
import {
  CLINIC_ABILITIES,
  clinicRoleViewSchema,
  FULL_GRANTS,
  NO_GRANTS,
} from './access-contracts.ts';
import { branchRef } from './fixtures/organization.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  compareTeamMembers,
  fetchAllMembers,
  fetchAllRoles,
  fetchMyStaffProfile,
  fetchStaffProfiles,
  joinClinicRoles,
  joinTeam,
  removeStaffProfile,
  saveStaffProfile,
  teamMemberMatchesSearch,
  withPlatformAccess,
} from './users-api.ts';
import {
  STAFF_PROFILE_DEFAULTS,
  type StaffProfile,
  type StaffProfileInput,
  type TeamMember,
  teamMemberSchema,
} from './users-contracts.ts';

const { listMembers, listRoles } = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', () => ({ listMembers, listRoles }));

/** A clinozy-be role, as `listRoles` maps it. */
function platformRole(key: string, name: string, isSystem: boolean): RoleSummary {
  return {
    id: `rol_${key.padEnd(21, 'a')}`,
    name,
    description: '',
    permissions: [],
    memberCount: 0,
    isSystem,
  };
}

const ROLES = {
  owner: platformRole('owner', 'Owner', true),
  admin: platformRole('admin', 'Admin', true),
  member: platformRole('member', 'Member', true),
  viewer: platformRole('viewer', 'Viewer', true),
  doctor: platformRole('doctor', 'Doctor', false),
  senior: platformRole('senior', 'Senior desk', false),
};
const PLATFORM_ROLES = Object.values(ROLES);

/** A clinozy-be membership, as `listMembers` maps it. */
function member(
  key: string,
  email: string,
  role: RoleSummary = ROLES.member,
  overrides: Partial<Member> = {},
): Member {
  return {
    id: `mbr_${key}`,
    userId: `usr_${key}`,
    name: email,
    email,
    role: role === ROLES.owner ? 'owner' : 'member',
    roleId: role.id,
    roleName: role.name,
    status: 'active',
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
    ...overrides,
  };
}

/** A profile save with the drawer's defaults. */
function profileInput(overrides: Partial<StaffProfileInput> = {}): StaffProfileInput {
  return {
    ...STAFF_PROFILE_DEFAULTS,
    roleKeys: [...STAFF_PROFILE_DEFAULTS.roleKeys],
    workingDays: [...STAFF_PROFILE_DEFAULTS.workingDays],
    branchIds: [branchRef('Adajan')],
    membershipId: 'mbr_new',
    name: 'Dr. Ishita Rao',
    email: 'ishita@clinic.com',
    ...overrides,
  };
}

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (
    error.data as { error: { code: string; detail: string; fields?: object } }
  ).error;
  return { status: error.status, ...body };
}

const profileOf = (seq: number): StaffProfile => {
  const profile = clinicFixtures.staff.snapshot((row) => row.seq === seq)[0];
  if (!profile) throw new Error(`the seed has staff #${seq}`);
  return profile;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T04:30:00Z'));
  resetClinicFixtures();
  resetClinicAccessFixture();
  listMembers.mockReset();
  listRoles.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
  resetClinicAccessFixture();
});

describe('the clinozy-be reads, every page up front', () => {
  it('reads the roster page after page, 100 at a time', async () => {
    const first = member('a', 'a@clinic.com');
    const second = member('b', 'b@clinic.com');
    listMembers
      .mockResolvedValueOnce({ rows: [first], next: 'cursor-2', hasMore: true })
      .mockResolvedValueOnce({ rows: [second], next: null, hasMore: false });
    expect(await fetchAllMembers()).toEqual([first, second]);
    expect(listMembers).toHaveBeenNthCalledWith(1, { limit: 100 });
    expect(listMembers).toHaveBeenNthCalledWith(2, { limit: 100, after: 'cursor-2' });
  });

  it('reads the roles the same way, stopping when no page follows', async () => {
    listRoles.mockResolvedValueOnce({
      rows: PLATFORM_ROLES,
      next: 'stale',
      hasMore: false,
    });
    expect(await fetchAllRoles()).toEqual(PLATFORM_ROLES);
    expect(listRoles).toHaveBeenCalledTimes(1);
  });
});

describe('staff profiles (fixture, REPLACE_WITH_API)', () => {
  it('reads every live profile — the sixteen seeded staff, none claimed yet', async () => {
    const profiles = await fetchStaffProfiles();
    expect(profiles).toHaveLength(16);
    expect(profiles.every((profile) => profile.membershipId === null)).toBe(true);
    expect(profileOf(12)).toMatchObject({
      roles: ['front_desk', 'admin'],
      roleKeys: ['front_desk', 'admin'],
      initials: 'RS',
    });
  });

  it('finds the signed-in member’s profile by email, in any case', async () => {
    expect((await fetchMyStaffProfile(' Riya@Cresence.SKIN '))?.seq).toBe(12);
    expect(await fetchMyStaffProfile('owner@elsewhere.com')).toBeNull();
    expect(await fetchMyStaffProfile(null)).toBeNull();
    expect(await fetchMyStaffProfile('  ')).toBeNull();
  });

  it('creates a profile for a new member with the next #ID, the name split before the last word', async () => {
    const saved = await saveStaffProfile(
      profileInput({
        roleKeys: ['doctor', ROLES.senior.id],
        phone: '+919876543210',
      }),
    );
    expect(saved).toMatchObject({
      seq: 19,
      membershipId: 'mbr_new',
      firstName: 'Dr. Ishita',
      lastName: 'Rao',
      initials: 'IR',
      roles: ['doctor'],
      roleKeys: ['doctor', ROLES.senior.id],
      presence: 'away',
      lastActiveAt: null,
      tone: 'sky',
    });
    expect(await fetchMyStaffProfile('ishita@clinic.com')).toEqual(saved);
  });

  it('updates the profile its membership already has, keeping its #ID', async () => {
    const created = await saveStaffProfile(profileInput());
    const updated = await saveStaffProfile(
      profileInput({ name: 'Ishita', commissionPct: 10, roleKeys: ['therapist'] }),
    );
    expect(updated).toMatchObject({
      id: created.id,
      seq: created.seq,
      firstName: 'Ishita',
      lastName: null,
      commissionPct: 10,
      roles: ['therapist'],
    });
    expect(await fetchStaffProfiles()).toHaveLength(17);
  });

  it('claims a seeded profile by its email — the sign-in id — rather than making a second', async () => {
    const claimed = await saveStaffProfile(
      profileInput({
        membershipId: 'mbr_riya',
        name: 'Riya Shah',
        email: 'RIYA@cresence.skin',
      }),
    );
    expect(claimed).toMatchObject({
      id: ref.user(12),
      seq: 12,
      membershipId: 'mbr_riya',
    });
    expect(await fetchStaffProfiles()).toHaveLength(16);
  });

  it('never stores Owner — clinozy-be decides who owns the organisation', async () => {
    const saved = await saveStaffProfile(
      profileInput({ roleKeys: ['owner', 'front_desk', 'admin'] }),
    );
    expect(saved).toMatchObject({
      roles: ['front_desk', 'admin'],
      roleKeys: ['front_desk', 'admin'],
    });
    const onlyOwner = await failureOf(
      saveStaffProfile(profileInput({ roleKeys: ['owner'] })),
    );
    expect(onlyOwner).toMatchObject({ status: 422, detail: 'Pick at least one role' });
  });

  it('refuses an email another member’s profile has (409)', async () => {
    await saveStaffProfile(profileInput());
    const failure = await failureOf(
      saveStaffProfile(profileInput({ email: 'nisha@cresence.skin' })),
    );
    expect(failure).toMatchObject({
      status: 409,
      code: 'conflict',
      fields: { email: ['A user with this email already exists'] },
    });
  });

  it.each<[string, Partial<StaffProfileInput>, string, string]>([
    ['no name', { name: '  ' }, 'name', 'Add name and email'],
    ['a bad email', { email: 'not-an-email' }, 'email', 'Enter a valid email address'],
    ['no role', { roleKeys: [] }, 'roleKeys', 'Pick at least one role'],
    ['an unknown role', { roleKeys: ['receptionist'] }, 'roleKeys.0', ''],
    [
      'To before From',
      { startsAt: '19:00', endsAt: '10:00' },
      'endsAt',
      'To must be after From',
    ],
    ['a commission over 100%', { commissionPct: 120 }, 'commissionPct', ''],
    ['a branch the clinic hasn’t', { branchIds: [ref.branch(9)] }, 'branchIds', ''],
  ])('refuses %s (422)', async (_label, change, field, message) => {
    const failure = await failureOf(saveStaffProfile(profileInput(change)));
    expect(failure.status).toBe(422);
    expect(failure.fields).toHaveProperty([field]);
    if (message) expect(failure.detail).toBe(message);
  });

  it('removes a profile with the Reason confirm’s choice — "Other" needs a note', async () => {
    const saved = await saveStaffProfile(profileInput());
    expect((await failureOf(removeStaffProfile(saved.id, 'other', null))).status).toBe(
      422,
    );
    await removeStaffProfile(saved.id, 'no_longer_needed', null);
    expect(await fetchMyStaffProfile('ishita@clinic.com')).toBeNull();
  });
});

describe('joinTeam — members ⨝ staff profiles (D17)', () => {
  it('joins a member to the profile its membership claimed', async () => {
    await saveStaffProfile(
      profileInput({ membershipId: 'mbr_ishita', roleKeys: ['doctor'] }),
    );
    const [row] = joinTeam({
      members: [member('ishita', 'ishita@clinic.com', ROLES.doctor)],
      profiles: await fetchStaffProfiles(),
      platformRoles: PLATFORM_ROLES,
    });
    expect(row).toMatchObject({
      membershipId: 'mbr_ishita',
      name: 'Dr. Ishita Rao',
      initials: 'IR',
      seq: 19,
      roleKeys: ['doctor'],
      branchIds: [branchRef('Adajan')],
      presence: 'away',
    });
    expect(teamMemberSchema.parse(row)).toEqual(row);
  });

  it('joins by email, in any case, a profile no membership has claimed', async () => {
    const [row] = joinTeam({
      members: [member('riya', ' Riya@Cresence.skin', ROLES.admin)],
      profiles: await fetchStaffProfiles(),
      platformRoles: PLATFORM_ROLES,
    });
    expect(row).toMatchObject({
      name: 'Riya Shah',
      seq: 12,
      phone: '+919825044120',
      tone: 'blush',
      roleKeys: ['front_desk', 'admin'],
      presence: 'online',
    });
    expect(row?.profile?.id).toBe(ref.user(12));
  });

  it('shows a member without a staff profile from the membership alone', async () => {
    const [row] = joinTeam({
      members: [
        member('mehta', 'k.mehta@clinic.com', ROLES.admin, { name: 'Kavya Mehta' }),
      ],
      profiles: await fetchStaffProfiles(),
      platformRoles: PLATFORM_ROLES,
    });
    expect(row).toMatchObject({
      name: 'Kavya Mehta',
      initials: 'KM',
      tone: toneForLabel('k.mehta@clinic.com'),
      roleKeys: ['admin'],
      seq: null,
      phone: null,
      branchIds: [],
      presence: null,
      profile: null,
    });
    expect(teamMemberSchema.parse(row)).toEqual(row);
  });

  it('shows an invited member under the name the drawer gave their profile, with the invitation', async () => {
    const invitation = { id: 'inv_one', expiresAt: '2026-10-10T04:30:00.000Z' };
    await saveStaffProfile(profileInput({ membershipId: 'mbr_ishita' }));
    const [row] = joinTeam({
      members: [
        member('ishita', 'ishita@clinic.com', ROLES.member, {
          status: 'invited',
          joinedAt: '',
          invitation,
        }),
      ],
      profiles: await fetchStaffProfiles(),
      platformRoles: PLATFORM_ROLES,
    });
    expect(row).toMatchObject({
      status: 'invited',
      invitation,
      joinedAt: null,
      name: 'Dr. Ishita Rao',
      roleKeys: ['front_desk'],
    });
  });

  it('leaves out a profile whose person isn’t a member — and never lets one email take another’s claimed profile', async () => {
    await saveStaffProfile(profileInput({ membershipId: 'mbr_ishita' }));
    const team = joinTeam({
      members: [
        member('ishita', 'ishita@clinic.com'),
        member('copy', 'ishita@clinic.com'),
      ],
      profiles: await fetchStaffProfiles(),
    });
    expect(team).toHaveLength(2);
    expect(team.find((row) => row.membershipId === 'mbr_ishita')?.seq).toBe(19);
    expect(team.find((row) => row.membershipId === 'mbr_copy')?.profile).toBeNull();
  });

  it('marks the owner’s row and the signed-in member’s own', async () => {
    const team = joinTeam({
      members: [
        member('owner', 'owner@clinic.com', ROLES.owner),
        member('me', 'me@clinic.com', ROLES.admin),
      ],
      profiles: [],
      platformRoles: PLATFORM_ROLES,
      selfUserId: 'usr_me',
    });
    const byId = (id: string) => team.find((row) => row.membershipId === id);
    expect(byId('mbr_owner')).toMatchObject({
      isOwner: true,
      isSelf: false,
      roleKeys: ['owner'],
    });
    expect(byId('mbr_me')).toMatchObject({
      isOwner: false,
      isSelf: true,
      roleKeys: ['admin'],
    });
  });

  it('puts the profile’s roles first, then the clinic role the membership’s role grants', async () => {
    await saveStaffProfile(profileInput({ membershipId: 'mbr_a', roleKeys: ['doctor'] }));
    await saveStaffProfile(
      profileInput({
        membershipId: 'mbr_b',
        email: 'b@clinic.com',
        roleKeys: ['therapist'],
      }),
    );
    const team = joinTeam({
      members: [
        member('a', 'ishita@clinic.com', ROLES.admin),
        member('b', 'b@clinic.com', ROLES.senior),
        member('c', 'c@clinic.com', ROLES.viewer),
      ],
      profiles: await fetchStaffProfiles(),
      platformRoles: PLATFORM_ROLES,
    });
    expect(team.map((row) => row.roleKeys)).toEqual([
      ['therapist', ROLES.senior.id],
      ['doctor', 'admin'],
      [],
    ]);
  });

  it('grants nothing for a custom platform role it can’t confirm without the roles list', () => {
    const [row] = joinTeam({
      members: [member('b', 'b@clinic.com', ROLES.senior)],
      profiles: [],
    });
    expect(row?.roleKeys).toEqual([]);
  });

  it('orders the Team newest #ID first, members without a profile after by name', async () => {
    const team = joinTeam({
      members: [
        member('zed', 'zed@clinic.com', ROLES.member, { name: 'Zed' }),
        member('ridhi', 'ridhi@cresence.skin'),
        member('amy', 'amy@clinic.com', ROLES.member, { name: 'Amy' }),
        member('riya', 'riya@cresence.skin'),
      ],
      profiles: await fetchStaffProfiles(),
    });
    expect(team.map((row) => row.seq ?? row.name)).toEqual([12, 8, 'Amy', 'Zed']);
  });

  it('prefers the membership’s last activity to the profile’s', async () => {
    const [row] = joinTeam({
      members: [
        member('riya', 'riya@cresence.skin', ROLES.admin, {
          lastActiveAt: '2026-10-03T04:00:00.000Z',
        }),
      ],
      profiles: await fetchStaffProfiles(),
    });
    expect(row?.lastActiveAt).toBe('2026-10-03T04:00:00.000Z');
  });
});

describe('the Team, searched and sorted in place', () => {
  async function team(): Promise<TeamMember[]> {
    return joinTeam({
      members: [
        member('riya', 'riya@cresence.skin', ROLES.admin),
        member('reenal', 'reenal@cresence.skin', ROLES.doctor),
        member('ridhi', 'ridhi@cresence.skin'),
        member('kavya', 'kavya@clinic.com', ROLES.member, { name: 'Kavya Mehta' }),
      ],
      profiles: await fetchStaffProfiles(),
      platformRoles: PLATFORM_ROLES,
    });
  }

  it.each<[string, string[]]>([
    ['', ['riya', 'reenal', 'ridhi', 'kavya']],
    ['RIYA', ['riya']],
    ['cresence', ['riya', 'reenal', 'ridhi']],
    ['98250 44120', ['riya']],
    ['9328790051', ['reenal']],
    ['#8', ['ridhi']],
    ['#1', ['riya', 'reenal']],
    ['mehta', ['kavya']],
    ['nobody', []],
  ])('matches "%s" on the name, email, mobile or #ID', async (query, ids) => {
    const rows = (await team()).filter((row) => teamMemberMatchesSearch(row, query));
    expect(rows.map((row) => row.membershipId.slice(4))).toEqual(ids);
  });

  const sorted = async (...args: Parameters<typeof compareTeamMembers>) =>
    [...(await team())]
      .sort(compareTeamMembers(...args))
      .map((row) => row.membershipId.slice(4));

  it('sorts by #ID either way, a member without one last', async () => {
    expect(await sorted('seq', 'asc')).toEqual(['ridhi', 'reenal', 'riya', 'kavya']);
    expect(await sorted('seq', 'desc')).toEqual(['riya', 'reenal', 'ridhi', 'kavya']);
  });

  it('sorts by name and email', async () => {
    expect(await sorted('name', 'asc')).toEqual(['reenal', 'kavya', 'ridhi', 'riya']);
    expect(await sorted('email', 'desc')).toEqual(['riya', 'ridhi', 'reenal', 'kavya']);
  });

  it('sorts by the main role’s name', async () => {
    const names: Record<string, string> = {
      front_desk: 'Front desk',
      doctor: 'Doctor',
      therapist: 'Therapist',
    };
    expect(await sorted('role', 'asc', (key) => names[key] ?? key)).toEqual([
      'reenal',
      'riya',
      'ridhi',
      'kavya',
    ]);
  });

  it('sorts by commission, status and last update, a member without a profile last', async () => {
    expect(await sorted('commission', 'desc')).toEqual([
      'reenal',
      'ridhi',
      'riya',
      'kavya',
    ]);
    expect(await sorted('status', 'asc')).toEqual(['riya', 'reenal', 'ridhi', 'kavya']);
    expect(await sorted('updatedAt', 'desc')).toEqual([
      'riya',
      'reenal',
      'ridhi',
      'kavya',
    ]);
  });

  it('puts an invited member after the active ones, and an inactive one last', async () => {
    const rows = joinTeam({
      members: [
        member('a', 'a@clinic.com', ROLES.member, { status: 'suspended' }),
        member('b', 'b@clinic.com', ROLES.member, { status: 'invited' }),
        member('c', 'c@clinic.com'),
      ],
      profiles: [],
    });
    expect(
      rows.sort(compareTeamMembers('status', 'asc')).map((row) => row.status),
    ).toEqual(['active', 'invited', 'suspended']);
  });
});

describe('joinClinicRoles — roles ⨝ the matrix', () => {
  async function roles(
    platformRoles: RoleSummary[] = PLATFORM_ROLES,
    matrix?: ClinicAccessMatrix,
  ) {
    const team = joinTeam({
      members: [
        member('riya', 'riya@cresence.skin', ROLES.admin),
        member('reenal', 'reenal@cresence.skin', ROLES.doctor),
        member('senior', 'senior@clinic.com', ROLES.senior),
      ],
      profiles: await fetchStaffProfiles(),
      platformRoles,
    });
    return joinClinicRoles({
      platformRoles,
      matrix: matrix ?? (await fetchClinicAccessMatrix()),
      team,
    });
  }

  it('lists the contract roles in the design’s order, then the custom roles — never Owner, Member or Viewer', async () => {
    expect((await roles()).map((role) => role.key)).toEqual([
      'admin',
      'doctor',
      'therapist',
      'front_desk',
      'counsellor',
      'pharmacist',
      'accountant',
      'marketing',
      ROLES.senior.id,
    ]);
  });

  it('binds a preset to the clinozy-be role of its name — Admin locked, a seeded role platform-backed', async () => {
    const [admin, doctor, therapist] = await roles();
    expect(admin).toMatchObject({
      preset: 'admin',
      name: 'Admin',
      locked: true,
      platformBacked: false,
      platformRole: { id: ROLES.admin.id, isSystem: true },
      abilities: [...CLINIC_ABILITIES],
    });
    expect(Object.values(admin?.grants ?? {})).toEqual(Array(9).fill(FULL_GRANTS));
    expect(doctor).toMatchObject({
      preset: 'doctor',
      tone: 'sky',
      locked: false,
      platformBacked: true,
      platformRole: { id: ROLES.doctor.id, isSystem: false },
    });
    expect(therapist).toMatchObject({
      name: 'Therapist',
      tone: 'butter',
      platformRole: null,
      platformBacked: false,
    });
  });

  it('reads each role’s grants and abilities from the matrix', async () => {
    const all = await roles();
    const frontDesk = all.find((role) => role.key === 'front_desk');
    expect(frontDesk?.grants.leads).toEqual({ ...FULL_GRANTS, delete: false });
    expect(frontDesk?.grants.medical).toEqual(NO_GRANTS);
    expect(frontDesk?.abilities).toEqual(['dayclose', 'refund']);
    for (const role of all) expect(clinicRoleViewSchema.parse(role)).toEqual(role);
  });

  it('gives a custom role its fixture tone and rows, or the design’s hash before it has any', async () => {
    let senior = (await roles()).at(-1);
    expect(senior).toMatchObject({
      preset: null,
      name: 'Senior desk',
      tone: toneForLabel('Senior desk'),
      platformBacked: true,
      abilities: [],
    });
    expect(Object.values(senior?.grants ?? {})).toEqual(Array(9).fill(NO_GRANTS));
    await saveRoleMatrixChange({ kind: 'addCustom', key: ROLES.senior.id, tone: 'lime' });
    senior = (await roles()).at(-1);
    expect(senior?.tone).toBe('lime');
  });

  it('names who holds each role — main role or not', async () => {
    const all = await roles();
    const holders = (key: string) => all.find((role) => role.key === key)?.memberIds;
    expect(holders('admin')).toEqual(['mbr_riya']);
    expect(holders('front_desk')).toEqual(['mbr_riya']);
    expect(holders('doctor')).toEqual(['mbr_reenal']);
    expect(holders(ROLES.senior.id)).toEqual(['mbr_senior']);
    expect(holders('therapist')).toEqual([]);
  });

  it('still lists every preset when the viewer can’t read clinozy-be roles', async () => {
    const all = await roles([]);
    expect(all).toHaveLength(8);
    expect(all.every((role) => role.platformRole === null)).toBe(true);
  });
});

describe('withPlatformAccess — the Users row and perms from clinozy-be codes (D17)', () => {
  it('reads a platform-backed role’s Users row and "Change roles & access" from its codes', async () => {
    const team = joinTeam({ members: [], profiles: [] });
    const [, doctor] = joinClinicRoles({
      platformRoles: PLATFORM_ROLES,
      matrix: await fetchClinicAccessMatrix(),
      team,
    });
    if (!doctor) throw new Error('Doctor is listed');
    const read = withPlatformAccess(doctor, [
      'organization:read',
      'membership:read',
      'role:read',
      'role:manage',
    ]);
    expect(read.grants.users).toEqual({ ...NO_GRANTS, view: true });
    expect(read.grants.leads).toEqual(doctor.grants.leads);
    expect(read.abilities).toEqual(['disc', 'allbr', 'clinical', 'export', 'perms']);
    expect(withPlatformAccess(read, ['organization:read']).abilities).not.toContain(
      'perms',
    );
  });

  it('leaves a role clinozy-be doesn’t back as it is', async () => {
    const [admin, , therapist] = joinClinicRoles({
      platformRoles: PLATFORM_ROLES,
      matrix: await fetchClinicAccessMatrix(),
      team: [],
    });
    if (!(admin && therapist)) throw new Error('both are listed');
    expect(withPlatformAccess(admin, [])).toBe(admin);
    expect(withPlatformAccess(therapist, ['membership:manage'])).toBe(therapist);
  });
});
