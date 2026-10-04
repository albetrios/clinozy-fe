import { beforeEach, describe, expect, it } from 'vitest';

import type { BranchInput } from './branches-contracts.ts';
import { fetchBranches, removeBranch, saveBranch } from './branches-manage-api.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';

beforeEach(() => resetClinicFixtures());

const NO_TEAM = { add: [], remove: [] } as const;

/** A new branch's fields, with `overrides`. */
function input(overrides: Partial<BranchInput> = {}): BranchInput {
  return {
    name: 'Piplod',
    tone: 'mint',
    isMain: false,
    active: true,
    addressLine1: '4th floor, Piplod Plaza',
    addressLine2: null,
    area: 'Piplod',
    city: 'Surat',
    state: 'Gujarat',
    pin: '395007',
    phone: '',
    email: '',
    gstNumber: null,
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    opensAt: '10:00',
    closesAt: '19:00',
    defaultDoctorId: null,
    defaultDeskId: null,
    defaultTherapistId: null,
    defaultPharmacistId: null,
    ...overrides,
  };
}

async function branchNamed(name: string) {
  const branch = (await fetchBranches()).find((candidate) => candidate.name === name);
  if (!branch) throw new Error(`no branch ${name}`);
  return branch;
}

describe('fetchBranches', () => {
  it('lists every branch, closed ones too, the main branch first then as opened', async () => {
    const vesu = await branchNamed('Vesu');
    await clinicFixtures.branches.update(vesu.id, { active: false });
    expect((await fetchBranches()).map((branch) => [branch.name, branch.active])).toEqual(
      [
        ['Adajan', true],
        ['Vesu', false],
        ['Varachha', true],
      ],
    );
  });
});

describe('saveBranch', () => {
  it('adds a branch last, with no phone or email until they are given', async () => {
    const saved = await saveBranch({ input: input(), team: NO_TEAM });
    expect(saved).toMatchObject({ name: 'Piplod', phone: '', email: '', isMain: false });
    expect((await fetchBranches()).at(-1)?.id).toBe(saved.id);
  });

  it('refuses a name another branch has, in any case', async () => {
    await expect(
      saveBranch({ input: input({ name: 'vesu' }), team: NO_TEAM }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'A branch called vesu already exists',
    });
  });

  it('keeps one main branch: a new main clears the old, none left main makes the first main', async () => {
    const saved = await saveBranch({ input: input({ isMain: true }), team: NO_TEAM });
    const branches = await fetchBranches();
    expect(branches.filter((branch) => branch.isMain).map((branch) => branch.id)).toEqual(
      [saved.id],
    );

    await saveBranch({ id: saved.id, input: input({ isMain: false }), team: NO_TEAM });
    expect(
      (await fetchBranches()).filter((branch) => branch.isMain).map((b) => b.name),
    ).toEqual(['Adajan']);
  });

  it('moves the Team change’s people on and off the branch, no one else', async () => {
    const vesu = await branchNamed('Vesu');
    const [riya, reenal] = clinicFixtures.staff.snapshot((profile) =>
      ['riya@cresence.skin', 'reenal@cresence.skin'].includes(profile.email),
    );
    if (!(riya && reenal)) throw new Error('the seed has Riya and Reenal');
    const riyaOnVesu = riya.branchIds.includes(vesu.id);
    await saveBranch({
      id: vesu.id,
      input: input({ name: 'Vesu' }),
      team: { add: [reenal.id], remove: riyaOnVesu ? [riya.id] : [] },
    });
    const branchesOf = (email: string) =>
      clinicFixtures.staff.snapshot((profile) => profile.email === email)[0]?.branchIds ??
      [];
    expect(branchesOf('reenal@cresence.skin')).toContain(vesu.id);
    expect(branchesOf('riya@cresence.skin')).not.toContain(vesu.id);
  });

  it('refuses Closes at or before Opens', async () => {
    await expect(
      saveBranch({
        input: input({ opensAt: '19:00', closesAt: '10:00' }),
        team: NO_TEAM,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('removeBranch', () => {
  it('removes a branch and takes it off everyone’s profile', async () => {
    const vesu = await branchNamed('Vesu');
    await removeBranch(vesu.id, 'not_needed', null);
    expect((await fetchBranches()).map((branch) => branch.name)).not.toContain('Vesu');
    expect(
      clinicFixtures.staff.snapshot((profile) => profile.branchIds.includes(vesu.id)),
    ).toHaveLength(0);
  });

  it('never removes the main branch', async () => {
    const adajan = await branchNamed('Adajan');
    await expect(removeBranch(adajan.id, 'not_needed', null)).rejects.toMatchObject({
      status: 422,
    });
  });
});
