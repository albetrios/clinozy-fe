import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';

/**
 * The branch a new record files under — a patient's home branch
 * (`patients.md:49`), a booking's branch (`S:331`): the header's branch when
 * it shows exactly one open branch, else the main branch; `null` while the
 * branches have not loaded.
 */
export function defaultBranchId(
  branches: readonly Pick<Branch, 'id' | 'isMain'>[],
  branchFilter: readonly string[],
): string | null {
  const open = new Set(branches.map((branch) => branch.id));
  const shown = branchFilter.filter((id) => open.has(id));
  if (shown.length === 1) return shown[0] ?? null;
  return branches.find((branch) => branch.isMain)?.id ?? branches[0]?.id ?? null;
}
