import type { StaffProfile } from './staff-fixture-contracts.ts';

/*
 * The fixture world's staff reads (REPLACE_WITH_API with each room that still reads them: Medical
 * sales, the fixture leads). The fixture world is imported on demand, so its seed data never lands
 * in the shell's chunk.
 */

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

const sameEmail = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** TanStack Query keys for the fixture staff. */
export const fixtureStaffQueryKeys = {
  all: ['app', 'fixture-staff'] as const,
  list: () => [...fixtureStaffQueryKeys.all, 'list'] as const,
  /** The signed-in member's fixture record, by their sign-in email. */
  mine: (email: string | null) => [...fixtureStaffQueryKeys.all, 'mine', email] as const,
};

/** Every fixture staff member. */
export async function fetchFixtureStaff(): Promise<StaffProfile[]> {
  const { appFixtures } = await fixtureWorld();
  return appFixtures.staff.snapshot();
}

/** The fixture staff member with the signed-in member's email; null without one. */
export async function fetchFixtureMyStaff(
  email: string | null,
): Promise<StaffProfile | null> {
  if (!email?.trim()) return null;
  const { appFixtures } = await fixtureWorld();
  return (
    appFixtures.staff.snapshot((profile) => sameEmail(profile.email, email))[0] ?? null
  );
}
