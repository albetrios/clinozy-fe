import { useMemo } from 'react';

import {
  clinicAccessQueryKeys,
  clinicRolesForMember,
  fetchClinicAccessMatrix,
  resolveClinicAccess,
} from '@/shared/api/clinic/access-api.ts';
import {
  type ClinicAbility,
  type ClinicAction,
  type ClinicRoleKey,
  isPresetRole,
} from '@/shared/api/clinic/access-contracts.ts';
import type { Role, Section } from '@/shared/api/clinic/clinic-schema.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useMyStaffProfile } from '@/shared/hooks/useTeam/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

/** The signed-in member's clinic access, narrowed by View-as while it runs. */
export interface ClinicAccess {
  /**
   * The contract roles in force, the main role first — the preview role while
   * View-as runs. A custom role counts in `can` but has no contract role.
   */
  roles: Role[];
  /** The role View-as previews — a contract role or a custom role's id — else null. */
  previewRole: ClinicRoleKey | null;
  can: (section: Section, action: ClinicAction) => boolean;
  canAbility: (ability: ClinicAbility) => boolean;
  /** Sections with View, in nav order; Today always. Empty until resolved. */
  viewableSections: Section[];
  /**
   * False until the permission set, the staff profile and the matrix have all
   * answered. An unresolved `false` means "not known yet", never "not
   * allowed" — gate placeholders and redirects on this.
   */
  isResolved: boolean;
}

/**
 * The clinic access matrix and abilities (fixture, REPLACE_WITH_API) — one
 * cache entry for `useClinicAccess` and Users › Roles & access, patched in
 * place by `useUpdateRoleMatrix`.
 */
export function useClinicAccessMatrix() {
  return useAppQuery({
    queryKey: clinicAccessQueryKeys.matrix(),
    queryFn: fetchClinicAccessMatrix,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

const NOTHING_YET = {
  can: () => false,
  canAbility: () => false,
  viewableSections: [] as Section[],
  isResolved: false,
};

/**
 * In-room access for the clinic screens (KICKOFF §3.7, D9): the fixture matrix
 * over the member's clinic roles — their staff profile's (L-31), else least
 * privilege from the platform codes — as the union, Admin and Owner passing
 * everything. The Users section and "Change roles & access" follow the
 * member's real clinozy-be codes instead (D17). A View-as preview narrows all
 * of it to the previewed role's matrix. Route gates stay the manifests'
 * platform permission and module; this decides the nav, buttons, row actions
 * and read-only drawers.
 */
export function useClinicAccess(): ClinicAccess {
  const permissions = useOrganizationStore((state) => state.permissions);
  const permissionsResolved = useOrganizationStore((state) => state.permissionsResolved);
  const previewRole = useUIStore((state) => state.previewRole);
  const profile = useMyStaffProfile();
  const { data: matrix } = useClinicAccessMatrix();
  const staffRoles = profile.data?.roleKeys ?? null;
  const profileResolved = !profile.isPending;

  return useMemo(() => {
    const roleKeys = previewRole
      ? [previewRole]
      : clinicRolesForMember({ staffRoles, permissions });
    const roles = roleKeys.filter(isPresetRole);
    if (!(matrix && permissionsResolved && profileResolved)) {
      return { roles, previewRole, ...NOTHING_YET };
    }
    return {
      roles,
      previewRole,
      isResolved: true,
      ...resolveClinicAccess(
        matrix,
        roleKeys,
        previewRole ? {} : { platformCodes: permissions },
      ),
    };
  }, [
    matrix,
    permissions,
    permissionsResolved,
    previewRole,
    profileResolved,
    staffRoles,
  ]);
}
