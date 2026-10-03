import type { Branch } from './clinic-schema.ts';

/** TanStack Query keys for the clinic's branches. */
export const branchQueryKeys = {
  all: ['clinic', 'branches'] as const,
  active: () => [...branchQueryKeys.all, 'active'] as const,
};

/**
 * The clinic's active branches, the main branch first, then by name.
 * REPLACE_WITH_API: `listBranches`. The fixture world is imported on demand so
 * its seed data never lands in the shell's chunk.
 */
export async function fetchActiveBranches(): Promise<Branch[]> {
  const { clinicFixtures } = await import('./fixtures/world.fixtures.ts');
  return clinicFixtures.branches
    .snapshot((branch) => branch.active)
    .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name));
}
