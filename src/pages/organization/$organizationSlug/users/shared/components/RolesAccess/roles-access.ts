import { type ClinicAction, presetOfRole } from '@/shared/api/clinic/access-contracts.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';

import { USERS_KEYS } from '../../../users.constants.ts';

/** The preset a page opens on when the URL names no role, or one that is gone (H:5179). */
const DEFAULT_PRESET: Role = 'front_desk';

/** The role on screen: the URL's (its id) when it is listed, else Front desk, else the first. */
export function selectedRoleOf(
  roles: readonly RoleSummary[],
  selected: string | undefined,
): RoleSummary | null {
  return (
    roles.find((role) => role.id === selected) ??
    roles.find((role) => presetOfRole(role) === DEFAULT_PRESET) ??
    roles[0] ??
    null
  );
}

/**
 * A role's purpose line (`users.md:50`): a preset's own, "Custom role" for the
 * rest (Owner is never listed, Q-U2).
 */
export function rolePurposeKey(
  role: Pick<RoleSummary, 'name' | 'isSystem'>,
  page = false,
): string {
  const preset = presetOfRole(role);
  if (preset && preset !== 'owner') return USERS_KEYS.roles.purposes[preset];
  return page ? USERS_KEYS.roles.purposes.customPage : USERS_KEYS.roles.purposes.custom;
}

/** The members holding a role, in the Team's order. */
export function roleHolders(roleId: string, team: readonly TeamMember[]): TeamMember[] {
  return team.filter((member) => member.roleIds.includes(roleId));
}

/** The matrix's four actions, each with its box's accessible-name key. */
export const MATRIX_CELL_KEYS: Readonly<Record<ClinicAction, string>> = {
  view: USERS_KEYS.roles.matrix.cell.view,
  create: USERS_KEYS.roles.matrix.cell.create,
  edit: USERS_KEYS.roles.matrix.cell.edit,
  delete: USERS_KEYS.roles.matrix.cell.delete,
};

/** The matrix head's action labels. */
export const MATRIX_HEAD_KEYS: Readonly<Record<ClinicAction, string>> = {
  view: USERS_KEYS.roles.matrix.view,
  create: USERS_KEYS.roles.matrix.create,
  edit: USERS_KEYS.roles.matrix.edit,
  delete: USERS_KEYS.roles.matrix.delete,
};
