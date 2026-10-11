/**
 * Test doubles for the clinic shell's two server reads that every room renders under — the
 * member's branches (`GET /app/branches/my`) and their preferences
 * (`/app/memberships/me/preferences`). `setup.ts` swaps them in for every unit test file, so a
 * component test needs no HTTP: the branches are the fixture world's (the ids its records point
 * at) and the preferences an in-memory record that starts on the defaults.
 *
 * The api modules' own tests (`branches-api.test.ts`, `preferences-api.test.ts`) `vi.unmock`
 * them and test the real calls against a mocked `api`.
 */
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type { AppPreferences } from '@/shared/api/app/preferences-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

let storedPreferences: AppPreferences | null = null;

/**
 * Sign a member into an organization in the stores — the preferences are a membership's, so
 * `usePreferences` reads and saves them only for a signed-in member of an organization.
 */
export function signInTestMember(): void {
  useAuthStore.setState({
    user: { id: 'usr_test', email: 'member@clinic.test', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
}

/** Forget the saved preferences: the next read is the defaults again. */
export function resetPreferencesDouble(): void {
  storedPreferences = null;
}

/** `fetchMyPreferences` / `saveMyPreferences` over an in-memory record, merged like the server's PATCH. */
export function preferencesDouble(defaults: Readonly<AppPreferences>) {
  return {
    fetchMyPreferences: async (): Promise<AppPreferences> =>
      structuredClone(storedPreferences ?? defaults),
    saveMyPreferences: async (
      patch: Partial<AppPreferences>,
    ): Promise<AppPreferences> => {
      storedPreferences = {
        ...(storedPreferences ?? structuredClone(defaults)),
        ...patch,
      };
      return structuredClone(storedPreferences);
    },
  };
}

/** `fetchActiveBranches` over the fixture world: its active branches, the main one first. */
export async function fixtureActiveBranches(): Promise<BranchOption[]> {
  const { appFixtures } = await import('@/shared/api/app/fixtures/world.fixtures.ts');
  return appFixtures.branches
    .snapshot((branch) => branch.active)
    .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name))
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      tone: branch.tone,
      isMain: branch.isMain,
      opensAt: branch.opensAt,
      closesAt: branch.closesAt,
      workingDays: branch.workingDays,
    }));
}
