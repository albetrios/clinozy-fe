import { useMemo } from 'react';

import {
  type ClinicAbility,
  clinicAccessQueryKeys,
  type ClinicAction,
  clinicRolesForMember,
  fetchClinicAccessMatrix,
  resolveClinicAccess,
} from '@/shared/api/clinic/access-api.ts';
import type { Role, Section } from '@/shared/api/clinic/clinic-schema.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

/** The signed-in member's clinic access, narrowed by View-as while it runs. */
export interface ClinicAccess {
  /** The roles in force — the preview role while View-as runs. */
  roles: Role[];
  previewRole: Role | null;
  can: (section: Section, action: ClinicAction) => boolean;
  canAbility: (ability: ClinicAbility) => boolean;
  /** Sections with View, in nav order; Today always. Empty until resolved. */
  viewableSections: Section[];
  /**
   * False until the permission set and the matrix have both answered. An
   * unresolved `false` means "not known yet", never "not allowed" — gate
   * placeholders and redirects on this.
   */
  isResolved: boolean;
}

const NOTHING_YET = {
  can: () => false,
  canAbility: () => false,
  viewableSections: [] as Section[],
  isResolved: false,
};

/**
 * In-room access for the clinic screens (KICKOFF §3.7, D9): the fixture matrix
 * over the member's clinic roles (the union; Admin and Owner pass everything),
 * narrowed to the View-as role while a preview runs. Route gates stay the
 * manifests' platform permission and module; this decides the nav, buttons,
 * row actions and read-only drawers.
 */
export function useClinicAccess(): ClinicAccess {
  const permissions = useOrganizationStore((state) => state.permissions);
  const permissionsResolved = useOrganizationStore((state) => state.permissionsResolved);
  const previewRole = useUIStore((state) => state.previewRole);
  const { data: matrix } = useAppQuery({
    queryKey: clinicAccessQueryKeys.matrix(),
    queryFn: fetchClinicAccessMatrix,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return useMemo(() => {
    const roles = previewRole ? [previewRole] : clinicRolesForMember({ permissions });
    if (!(matrix && permissionsResolved)) return { roles, previewRole, ...NOTHING_YET };
    return {
      roles,
      previewRole,
      isResolved: true,
      ...resolveClinicAccess(matrix, roles),
    };
  }, [matrix, permissions, permissionsResolved, previewRole]);
}
