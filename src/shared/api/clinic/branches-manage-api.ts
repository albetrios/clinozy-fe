import { branchQueryKeys } from './branches-api.ts';
import { branchInputSchema, type BranchSave } from './branches-contracts.ts';
import { clinicHttpError, validateClinicInput } from './clinic-fixture-store.ts';
import type { Branch, DeleteReason } from './clinic-schema.ts';

/*
 * Users › Branches' reads and writes (KICKOFF §6.12 Branches, D6; fixtures,
 * REPLACE_WITH_API: `listBranches`, `createBranch`, `updateBranch`,
 * `deleteBranch`, `S:154–181`). Kept apart from `branches-api.ts`, which the
 * shell's branch picker loads on every page: these load with the room. The
 * fixture world is imported on demand.
 */

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** The Branches tab's list key — under `branchQueryKeys.all`, so a write refreshes the picker too. */
export const branchListKey = () => [...branchQueryKeys.all, 'list'] as const;

const MAIN_UNDELETABLE = 'The main branch can’t be deleted';

/** The branches' order (`users.md:87`): the main branch first, then as they were opened. */
function byMainThenOpened(a: Branch, b: Branch): number {
  return Number(b.isMain) - Number(a.isMain) || a.createdAt.localeCompare(b.createdAt);
}

/**
 * Every branch, open and closed — the Branches tab lists the closed ones as
 * "Closed" (`users.md:95`) — the main branch first, then as they were opened.
 */
export async function fetchBranches(): Promise<Branch[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.branches.snapshot().sort(byMainThenOpened);
}

/**
 * Save a branch (`users.md:179–198`; H:5220–5222): a 422 names a broken rule,
 * a 409 a name another branch has in any case ("A branch called Vesu already
 * exists"). Saved as main, it clears main on the others; with none left
 * main, the first branch becomes main. The Team change adds the branch to
 * each picked person's profile and takes it off each one dropped (Appendix
 * F); relations are by id, so a rename needs no fan-out (§3.6).
 */
export async function saveBranch({ id, input, team }: BranchSave): Promise<Branch> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(branchInputSchema, input);
  const branches = clinicFixtures.branches.snapshot();
  const taken = branches.some(
    (branch) =>
      branch.id !== id && branch.name.trim().toLowerCase() === fields.name.toLowerCase(),
  );
  if (taken) {
    const message = `A branch called ${fields.name} already exists`;
    throw clinicHttpError(409, 'conflict', message, { name: [message] });
  }
  const saved = id
    ? await clinicFixtures.branches.update(id, fields)
    : await clinicFixtures.branches.create(fields);

  if (saved.isMain) {
    for (const other of branches.filter(
      (branch) => branch.isMain && branch.id !== saved.id,
    )) {
      await clinicFixtures.branches.update(other.id, { isMain: false });
    }
  } else if (!clinicFixtures.branches.snapshot().some((branch) => branch.isMain)) {
    const [first] = clinicFixtures.branches.snapshot().sort(byMainThenOpened);
    if (first) await clinicFixtures.branches.update(first.id, { isMain: true });
  }

  const adding = new Set(team.add);
  const removing = new Set(team.remove);
  for (const profile of clinicFixtures.staff.snapshot()) {
    const has = profile.branchIds.includes(saved.id);
    if (adding.has(profile.id) && !has) {
      await clinicFixtures.staff.update(profile.id, {
        branchIds: [...profile.branchIds, saved.id],
      });
    } else if (removing.has(profile.id) && has) {
      await clinicFixtures.staff.update(profile.id, {
        branchIds: profile.branchIds.filter((branchId) => branchId !== saved.id),
      });
    }
  }
  return clinicFixtures.branches.get(saved.id);
}

/**
 * Delete a branch with the Reason confirm's choice, once its deferred removal
 * lands (after the Undo window): never the main branch (422). Its people
 * lose it from their profiles — a removed branch is no branch to work at.
 */
export async function removeBranch(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<Branch> {
  const { clinicFixtures } = await fixtureWorld();
  const branch = await clinicFixtures.branches.get(id);
  if (branch.isMain) {
    throw clinicHttpError(422, 'validation', MAIN_UNDELETABLE, {
      root: [MAIN_UNDELETABLE],
    });
  }
  const removed = await clinicFixtures.branches.remove(id, reason, note);
  for (const profile of clinicFixtures.staff.snapshot((row) =>
    row.branchIds.includes(id),
  )) {
    await clinicFixtures.staff.update(profile.id, {
      branchIds: profile.branchIds.filter((branchId) => branchId !== id),
    });
  }
  return removed;
}
