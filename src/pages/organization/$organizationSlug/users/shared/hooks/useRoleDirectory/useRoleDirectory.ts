import { useCallback, useMemo } from 'react';

import { presetOfRole } from '@/shared/api/app/access-contracts.ts';
import type { Role, Tone } from '@/shared/api/app/app-schema.ts';
import { isOwnerRole, type RoleSummary } from '@/shared/api/organization-contracts.ts';
import { toneForLabel } from '@/shared/app/app-tones.ts';
import { useRoleLabel } from '@/shared/hooks/useAppRoles/index.ts';
import { usePlatformRoles } from '@/shared/hooks/useTeam/index.ts';

/** A role as a pill: its id, its name and its tone. */
export interface RolePill {
  id: string;
  label: string;
  tone: Tone;
}

/** The room's roles and how each is named and toned. */
export interface RoleDirectory {
  /**
   * The roles Roles & access lists: the presets in the order the clinic was provisioned with them
   * (Owner aside — the owner's own role, never given or edited here, Q-U2), then the clinic's own.
   */
  roles: RoleSummary[];
  /** Every listed role as a pill, in the list's order — the drawer's Roles chips, the Team's filter. */
  options: RolePill[];
  /** A role's name — a preset's in the clinic's own words, the clinic's own role by its name. */
  label: (roleId: string) => string;
  tone: (roleId: string) => Tone;
  /** The preset a role is, else null for the clinic's own role. */
  preset: (roleId: string) => Role | null;
  /** The id of the clinic's role for a preset (Front desk's, a Quick fill's), else null. */
  presetRoleId: (preset: Role) => string | null;
  /** These roles as pills, in the order given (the main role first). */
  pills: (roleIds: readonly string[]) => RolePill[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * The Users room's role directory (KICKOFF §6.12): clinozy-be's roles (`role:read` — the room is
 * Owner's and Admin's) named and toned the way every Users screen shows them — a preset by its
 * clinic name, any role in the tone clinozy-be keeps for it.
 */
export function useRoleDirectory(): RoleDirectory {
  const nameOf = useRoleLabel();
  const { roles: all, isPending, isError, refetch } = usePlatformRoles();

  const byId = useMemo(() => new Map(all.map((role) => [role.id, role])), [all]);
  const roles = useMemo(() => all.filter((role) => !isOwnerRole(role)), [all]);

  const preset = useCallback(
    (roleId: string) => {
      const role = byId.get(roleId);
      return role ? presetOfRole(role) : null;
    },
    [byId],
  );
  const presetRoleId = useCallback(
    (wanted: Role) => all.find((role) => presetOfRole(role) === wanted)?.id ?? null,
    [all],
  );
  const label = useCallback(
    (roleId: string) => {
      const role = byId.get(roleId);
      return role ? nameOf({ name: role.name, preset: presetOfRole(role) }) : '';
    },
    [byId, nameOf],
  );
  const tone = useCallback(
    (roleId: string): Tone => byId.get(roleId)?.tone ?? toneForLabel(roleId),
    [byId],
  );
  const pills = useCallback(
    (roleIds: readonly string[]) =>
      roleIds.map((id) => ({ id, label: label(id), tone: tone(id) })),
    [label, tone],
  );

  return useMemo(
    () => ({
      roles,
      options: pills(roles.map((role) => role.id)),
      label,
      tone,
      preset,
      presetRoleId,
      pills,
      isPending,
      isError,
      refetch,
    }),
    [roles, pills, label, tone, preset, presetRoleId, isPending, isError, refetch],
  );
}
