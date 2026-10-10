import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import type { RoleCreateInput, RoleUpdateInput } from '@/shared/api/organization-api.ts';
import * as orgApi from '@/shared/api/organization-api.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import {
  type OrgListKeyParams,
  orgQueryKeys,
} from '@/shared/api/organization-query-keys.ts';
import {
  useAppMutation,
  type WriteReportOptions,
} from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import {
  type CursorListResult,
  useCursorList,
} from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** Server-side query params for the roles list (search + sort). */
export type RolesListParams = OrgListKeyParams;

/**
 * Roles of the active organization — windowed list query + create/update/delete
 * mutations. Server state only — never mirrored into Zustand (fe-file-structure.mdc).
 */
export function useRoles(params: RolesListParams = {}): CursorListResult<RoleSummary> {
  const orgId = useOrganizationStore((s) => s.organizationId);
  // `GET /tenancy/organization/roles` enforces `role:read`. The members panel calls this hook
  // from every member row regardless of whether it will render a role picker, so without this
  // guard the seeded **Viewer** role — which holds `organization:read` + `membership:read` and
  // nothing else — fired a guaranteed 403 every time it opened Settings → Members. The failure
  // was invisible in the UI (`notifyOnError: false`) but clinozy-be writes a permission-deny audit
  // row on every denial, so it was a request worth not making.
  const canReadRoles = useCan({ permission: 'role:read' });
  return useCursorList<RoleSummary>({
    queryKey: orgQueryKeys.rolesList(orgId, params),
    queryFn: (after) => orgApi.listRoles({ ...params, after }),
    // The roles panel renders a RetryError for exactly this failure.
    notifyOnError: false,
    // No active org (mid org-switch, or before context resolves) → skip the
    // request instead of firing a `Forbidden` against an empty org scope.
    enabled: Boolean(orgId) && canReadRoles,
  });
}

/**
 * A single role's permission codes. The roles list omits permissions, so the
 * edit form reads them here to pre-fill. Held until a `roleId` is provided.
 */
export function useRolePermissions(roleId: string | undefined) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppQuery({
    queryKey: orgQueryKeys.rolePermissions(orgId, roleId),
    queryFn: () => orgApi.getRolePermissions(roleId ?? ''),
    enabled: roleId !== undefined,
  });
}

/** Create a custom role in one call (codes, tone, "copy from"), then refresh the roles list. */
export function useCreateRole(options?: WriteReportOptions) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (input: RoleCreateInput, action) =>
      orgApi.createRole({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [orgQueryKeys.roles(orgId)],
    successMessage: options?.suppressSuccessToast
      ? undefined
      : (role) =>
          i18n.t(ERRORS_KEYS.frontend.hooks.roles.createSuccess, {
            ns: ERRORS_NS,
            name: role.name,
          }),
    notifyOnError: options?.notifyOnError ?? true,
  });
}

/**
 * Edit a role — its name, description and tone, and its whole code set when given. The row is
 * patched in every cached page at once; the role's codes and the roles list refresh after.
 */
export function useUpdateRole(options?: WriteReportOptions) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (input: RoleUpdateInput, action) =>
      orgApi.updateRole({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [orgQueryKeys.roles(orgId)],
    optimisticInfinite: {
      queryKey: orgQueryKeys.roles(orgId),
      update: (rows: RoleSummary[], input) =>
        rows.map((role) => (role.id === input.id ? withRoleChange(role, input) : role)),
    },
    successMessage: options?.suppressSuccessToast
      ? undefined
      : (role) =>
          i18n.t(ERRORS_KEYS.frontend.hooks.roles.updateSuccess, {
            ns: ERRORS_NS,
            name: role.name,
          }),
    notifyOnError: options?.notifyOnError ?? true,
  });
}

/**
 * Replace one role's codes with a whole new set (`PUT …/roles/:id/permissions`) — Roles & access'
 * boxes and switches. The role's codes change on screen at once and come back as they were when
 * clinozy-be refuses (a code the caller lacks, a locked role); the roles refresh after.
 */
export function useReplaceRolePermissions(roleId: string | undefined) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: ({ permissions }: { permissions: readonly string[] }) =>
      orgApi.replaceRolePermissions(roleId ?? '', permissions),
    invalidateKeys: [orgQueryKeys.roles(orgId)],
    optimistic: {
      queryKey: orgQueryKeys.rolePermissions(orgId, roleId),
      update: (_previous: string[] | undefined, { permissions }) => [...permissions],
    },
  });
}

/** A role with an edit applied — the optimistic row. */
export function withRoleChange(role: RoleSummary, input: RoleUpdateInput): RoleSummary {
  return {
    ...role,
    name: input.name ?? role.name,
    description: input.description ?? role.description,
    tone: input.tone ?? role.tone,
  };
}

/** What {@link useDeleteRole} takes: the role and why it goes. */
export interface RoleRemovalInput {
  roleId: string;
  reason: DeleteReason;
  note?: string;
}

/** Delete a custom role — optimistically drops it from the list. */
export function useDeleteRole(options?: { suppressSuccessToast?: boolean }) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (input: RoleRemovalInput) => orgApi.deleteRole(input),
    invalidateKeys: [orgQueryKeys.roles(orgId)],
    optimisticInfinite: {
      queryKey: orgQueryKeys.roles(orgId),
      update: (rows: RoleSummary[], { roleId }) =>
        rows.filter((role) => role.id !== roleId),
    },
    // See useRemoveMember: the undo toast owns the messaging on deferred paths.
    successMessage: options?.suppressSuccessToast
      ? undefined
      : i18n.t(ERRORS_KEYS.frontend.hooks.roles.deleteSuccess, { ns: ERRORS_NS }),
  });
}
