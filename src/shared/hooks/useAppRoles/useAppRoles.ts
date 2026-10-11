import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { presetOfRole } from '@/shared/api/app/access-contracts.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  type DirectoryRole,
  fetchRoleDirectory,
  roleDirectoryQueryKey,
} from '@/shared/api/app/directory-api.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { servedTone, toneForLabel } from '@/shared/app/app-tones.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

/** How long the role directory is reused before it is read again. */
const ROLE_DIRECTORY_STALE_MS = 5 * 60_000;

const NO_ROLES: DirectoryRole[] = [];

/** The organization's roles, and how each is named and toned. */
export interface AppRolesResult {
  /** Every role, in the directory's order (the presets as provisioned, then the clinic's own). */
  roles: DirectoryRole[];
  byId: ReadonlyMap<string, DirectoryRole>;
  /** A role's name — a preset's in the clinic's own words, the clinic's own role by its name. */
  label: (role: Pick<DirectoryRole, 'name' | 'preset'>) => string;
  /** A role's name by its id; `''` for a role the directory does not know. */
  labelOf: (roleId: string) => string;
  /** A role's tone by its id — the name's hash for a role the directory does not know. */
  toneOf: (roleId: string) => Tone;
  isPending: boolean;
}

/** A role's name — a preset's in the clinic's own words, the clinic's own role by its name. */
export function useRoleLabel(): (role: Pick<DirectoryRole, 'name' | 'preset'>) => string {
  const { t } = useTranslation(APP_NS);
  return useCallback(
    (role) => (role.preset ? t(APP_KEYS.roles[role.preset]) : role.name),
    [t],
  );
}

/**
 * The organization's roles as every member may read them (`GET /app/roles`, research-users B3):
 * a View-as preview's name and tone, the role pills of a member without `role:read`. Read once
 * per organization (while `enabled`) and reused for a few minutes.
 */
export function useAppRoles(enabled = true): AppRolesResult {
  const label = useRoleLabel();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const query = useAppQuery({
    queryKey: roleDirectoryQueryKey(organizationId),
    queryFn: fetchRoleDirectory,
    enabled: enabled && organizationId !== null,
    staleTime: ROLE_DIRECTORY_STALE_MS,
    // Its readers degrade to a role's raw name or no line at all.
    notifyOnError: false,
  });
  const roles = query.data ?? NO_ROLES;
  const byId = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const labelOf = useCallback(
    (roleId: string) => {
      const role = byId.get(roleId);
      return role ? label(role) : '';
    },
    [byId, label],
  );
  const toneOf = useCallback(
    (roleId: string) => byId.get(roleId)?.tone ?? toneForLabel(roleId),
    [byId],
  );
  return useMemo(
    () => ({ roles, byId, label, labelOf, toneOf, isPending: query.isPending }),
    [roles, byId, label, labelOf, toneOf, query.isPending],
  );
}

/**
 * The roles in force, the main role first: the signed-in member's own (`my_roles` on me/context —
 * no extra read), or — while View-as runs — the previewed role alone (from the directory, read
 * then). Empty until known. What the Account menu's role line and avatar tone, the View-as pill
 * and Today's focus read.
 */
export function useRolesInForce(): DirectoryRole[] {
  const previewRole = useUIStore((state) => state.previewRole);
  const me = useMeContext({ notifyOnError: false });
  // The directory is read only while a preview needs its role's name.
  const { byId } = useAppRoles(previewRole !== null);
  const myRoles = me.data?.myRoles;
  return useMemo(() => {
    if (previewRole !== null) {
      const role = byId.get(previewRole);
      return role ? [role] : [];
    }
    return (myRoles ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      tone: servedTone(role.tone, role.name),
      isSystem: role.isSystem,
      // me/context does not say; the directory does once read.
      isLocked: byId.get(role.id)?.isLocked ?? false,
      preset: presetOfRole(role),
    }));
  }, [previewRole, byId, myRoles]);
}
