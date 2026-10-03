import { useCallback, useMemo } from 'react';

import {
  applyRoleMatrixChange,
  type ClinicAccessMatrix,
  clinicAccessQueryKeys,
  type RoleMatrixChange,
  saveRoleMatrixChange,
} from '@/shared/api/clinic/access-api.ts';
import type {
  ClinicRoleKey,
  ClinicRoleView,
} from '@/shared/api/clinic/access-contracts.ts';
import { joinClinicRoles, withPlatformAccess } from '@/shared/api/clinic/users-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useClinicAccessMatrix } from '@/shared/hooks/useClinicAccess/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useRolePermissions } from '@/shared/hooks/useRoles/index.ts';
import { usePlatformRoles, useTeam } from '@/shared/hooks/useTeam/index.ts';

/** The roles and the state of their reads. */
export interface ClinicRolesResult {
  /** The contract's roles (Owner aside), then the custom roles — each ⨝ its matrix and holders. */
  roles: ClinicRoleView[];
  /** True until the matrix, the Team and (with `role:read`) the roles have answered. */
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Users › Roles & access (KICKOFF §6.12 Data): clinozy-be's roles — all pages —
 * joined with the fixture clinic matrix and abilities (REPLACE_WITH_API), each
 * role's tone and the Team members holding it. The roles sit under the `roles`
 * key prefix, so `useCreateRole`, `useUpdateRole` and `useDeleteRole` refresh
 * them.
 */
export function useClinicRoles(): ClinicRolesResult {
  const platformRoles = usePlatformRoles();
  const matrix = useClinicAccessMatrix();
  const team = useTeam();

  const roles = useMemo(
    () =>
      matrix.data
        ? joinClinicRoles({
            platformRoles: platformRoles.roles,
            matrix: matrix.data,
            team: team.members,
          })
        : [],
    [matrix.data, platformRoles.roles, team.members],
  );

  const { refetch: refetchRoles } = platformRoles;
  const { refetch: refetchMatrix } = matrix;
  const { refetch: refetchTeam } = team;
  const refetch = useCallback(() => {
    refetchRoles();
    void refetchMatrix();
    refetchTeam();
  }, [refetchRoles, refetchMatrix, refetchTeam]);

  return {
    roles,
    isPending: matrix.isPending || team.isPending || platformRoles.isPending,
    isError: matrix.isError || platformRoles.isError || team.isError,
    error: matrix.error ?? platformRoles.error ?? team.error ?? null,
    refetch,
  };
}

/** One role, its Users row and "Change roles & access" read from clinozy-be. */
export interface ClinicRoleResult {
  /** Null while loading, or when no role has the key. */
  role: ClinicRoleView | null;
  /** True until the role and — for a role clinozy-be backs — its permission codes have answered. */
  isPending: boolean;
}

/**
 * One role page's data: the role from {@link useClinicRoles} with its Users row
 * and "Change roles & access" read from its clinozy-be permission codes when
 * the platform backs it (D17; `GET /roles/:id/permissions`, `role:read`).
 */
export function useClinicRole(key: ClinicRoleKey | undefined): ClinicRoleResult {
  const { roles, isPending } = useClinicRoles();
  const view = roles.find((role) => role.key === key) ?? null;
  const platformId = view?.platformBacked ? view.platformRole?.id : undefined;
  const codes = useRolePermissions(platformId);
  const codesPending = platformId !== undefined && codes.isPending;
  return useMemo(
    () => ({
      role:
        view && codes.data && platformId ? withPlatformAccess(view, codes.data) : view,
      isPending: isPending || codesPending,
    }),
    [view, codes.data, platformId, isPending, codesPending],
  );
}

/**
 * Change the fixture matrix — a box, a Row pill, the switches, "Copy access
 * from", a custom role's rows (Q-U6: instant): optimistic, so the box flips at
 * once and every resolver (`useClinicAccess`, the nav) follows; a refused or
 * failed save rolls back with the save-error toast. The Users row and "Change
 * roles & access" of a role clinozy-be backs are its permission codes instead
 * — `platformCodesWithUsersAccess` through `useUpdateRole` (D17).
 */
export function useUpdateRoleMatrix(
  options: CrudMutationOptions<ClinicAccessMatrix, RoleMatrixChange> = {},
) {
  return useAppMutation<ClinicAccessMatrix, RoleMatrixChange, ClinicAccessMatrix>({
    mutationFn: saveRoleMatrixChange,
    invalidateKeys: [clinicAccessQueryKeys.all],
    optimistic: {
      queryKey: clinicAccessQueryKeys.matrix(),
      update: (previous, change) =>
        previous ? applyRoleMatrixChange(previous, change) : previous,
    },
    // Boxes are clicked in runs; one error toast replaces the last.
    toastId: 'role-matrix',
    ...options,
  });
}
