import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appFixtures, resetAppFixtures } from './fixtures/world.fixtures.ts';
import {
  fetchFixtureMyStaff,
  fetchFixtureStaff,
  fixtureStaffQueryKeys,
} from './staff-fixture-api.ts';

describe('the fixture staff reads', () => {
  beforeEach(() => resetAppFixtures());
  afterEach(() => resetAppFixtures());

  it('lists every fixture staff member', async () => {
    const staff = await fetchFixtureStaff();
    expect(staff.length).toBeGreaterThan(0);
    expect(staff).toEqual(appFixtures.staff.snapshot());
  });

  it('finds the signed-in member by email — whatever its case or spaces', async () => {
    const [someone] = appFixtures.staff.snapshot();
    if (!someone) throw new Error('the world seeds no staff');
    await expect(
      fetchFixtureMyStaff(`  ${someone.email.toUpperCase()} `),
    ).resolves.toEqual(someone);
  });

  it('answers none for no email, a blank one, or one the world does not know', async () => {
    await expect(fetchFixtureMyStaff(null)).resolves.toBeNull();
    await expect(fetchFixtureMyStaff('   ')).resolves.toBeNull();
    await expect(fetchFixtureMyStaff('nobody@nowhere.test')).resolves.toBeNull();
  });

  it('keys the signed-in member’s record by their email', () => {
    expect(fixtureStaffQueryKeys.mine('a@b.test')).toEqual([
      'app',
      'fixture-staff',
      'mine',
      'a@b.test',
    ]);
    expect(fixtureStaffQueryKeys.mine(null)).not.toEqual(
      fixtureStaffQueryKeys.mine('a@b.test'),
    );
    expect(fixtureStaffQueryKeys.list()).toEqual(['app', 'fixture-staff', 'list']);
  });
});
