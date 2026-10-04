import type {
  ClinicAction,
  ClinicRoleKey,
  ClinicRoleView,
} from '@/shared/api/clinic/access-contracts.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';

import { USERS_KEYS } from '../../../users.constants.ts';

/** The role a page opens on when the URL names none, or one that is gone (H:5179). */
export const DEFAULT_ROLE: ClinicRoleKey = 'front_desk';

/** The role on screen: the URL's when it is listed, else Front desk, else the first. */
export function selectedRoleOf(
  roles: readonly ClinicRoleView[],
  key: string | undefined,
): ClinicRoleView | null {
  return (
    roles.find((role) => role.key === key) ??
    roles.find((role) => role.key === DEFAULT_ROLE) ??
    roles[0] ??
    null
  );
}

/**
 * A role's purpose line (`users.md:50`): a preset's own, "Custom role" for the
 * rest (Owner is never listed, Q-U2).
 */
export function rolePurposeKey(
  role: Pick<ClinicRoleView, 'preset'>,
  page = false,
): string {
  if (role.preset && role.preset !== 'owner') {
    return USERS_KEYS.roles.purposes[role.preset];
  }
  return page ? USERS_KEYS.roles.purposes.customPage : USERS_KEYS.roles.purposes.custom;
}

/** The members holding a role, in the Team's order. */
export function roleHolders(
  role: Pick<ClinicRoleView, 'memberIds'>,
  team: readonly TeamMember[],
): TeamMember[] {
  const held = new Set(role.memberIds);
  return team.filter((member) => held.has(member.membershipId));
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
