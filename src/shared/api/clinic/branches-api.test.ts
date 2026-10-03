import { beforeEach, describe, expect, it } from 'vitest';

import { fetchActiveBranches } from './branches-api.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';

beforeEach(() => resetClinicFixtures());

describe('fetchActiveBranches', () => {
  it('lists the active branches, the main branch first', async () => {
    const branches = await fetchActiveBranches();
    expect(branches.length).toBeGreaterThan(1);
    expect(branches[0]?.isMain).toBe(true);
    expect(branches.every((branch) => branch.active)).toBe(true);
  });

  it('leaves out an inactive branch', async () => {
    const [, second] = await fetchActiveBranches();
    if (!second) throw new Error('the seed has a second branch');
    await clinicFixtures.branches.update(second.id, { active: false });
    expect((await fetchActiveBranches()).map((branch) => branch.id)).not.toContain(
      second.id,
    );
  });
});
