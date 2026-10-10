import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import { getRolePermissions } from '@/shared/api/organization-api.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import {
  useReplaceRolePermissions,
  useRolePermissions,
} from '@/shared/hooks/useRoles/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import {
  type MatrixRow,
  withBoxToggled,
  withCodeToggled,
  withRowToggled,
} from './roles-matrix.ts';

/**
 * Why the boxes and switches can't change: Admin is always full, the viewer may not change
 * roles, or the role holds a code the viewer lacks — clinozy-be checks the old set and the new
 * one against the editor's own codes, so nobody edits a role beyond their own access.
 */
type RoleLock = 'admin' | 'noPerms' | 'beyond' | null;

/** What a role page may write, and how. */
export interface RoleAccessWrites {
  /** Null when the boxes and switches are live. */
  lock: RoleLock;
  /** The role's codes; undefined while they load. */
  codes: readonly string[] | undefined;
  /** The role's codes could not be read: the page offers Retry. */
  codesFailed: boolean;
  retryCodes: () => void;
  /** Whether the viewer may give a code: they hold it themselves. */
  canGive: (code: string) => boolean;
  toggleBox: (row: MatrixRow, action: ClinicAction) => void;
  toggleRow: (row: MatrixRow) => void;
  /** A special or a workspace permission — one code — on or off. */
  toggleCode: (code: string) => void;
  copyFrom: (source: RoleSummary, sourceLabel: string, label: string) => Promise<void>;
}

/**
 * A role page's writes (KICKOFF §6.12 Roles & access; Q-U-B): every box, Row pill and switch
 * is the role's whole new code set (`PUT …/roles/:id/permissions`) — instant, rolled back with
 * the error toast when refused. "Copy access from" puts the other role's set in place. Admin
 * (`is_locked`), a viewer without `role:update`, and a role holding a code the viewer lacks
 * answer with the lock's toast instead; a code the viewer lacks can't be given either.
 */
export function useRoleAccessWrites(role: RoleSummary | null): RoleAccessWrites {
  const { t } = useTranslation(USERS_NS);
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const access = useClinicAccess();
  const codesQuery = useRolePermissions(role?.id);
  const codes: readonly string[] | undefined = codesQuery.data;
  const replace = useReplaceRolePermissions(role?.id);
  const canGive = (code: string) => access.isResolved && access.canCode(code);

  let lock: RoleLock = null;
  if (role?.isLocked) lock = 'admin';
  else if (!(access.isResolved && access.canCode('role:update'))) lock = 'noPerms';
  else if (codes?.some((code) => !canGive(code))) lock = 'beyond';

  /** Toast why nothing changed; true when the role may not be written. */
  const refused = (): boolean => {
    if (!lock) return false;
    notify.info(t(USERS_KEYS.roles.locked[lock]));
    return true;
  };

  /** Write the role's new set, unless it gives a code the viewer lacks. */
  const write = (next: readonly string[]) => {
    if (!(role && codes) || refused()) return;
    const added = next.filter((code) => !codes.includes(code));
    if (added.some((code) => !canGive(code))) {
      notify.info(t(USERS_KEYS.roles.locked.notYours));
      return;
    }
    replace.mutate({ permissions: next });
  };

  return {
    lock,
    codes,
    codesFailed: codesQuery.isError && codes === undefined,
    retryCodes: () => void codesQuery.refetch(),
    canGive,
    toggleBox: (row, action) => {
      if (codes) write(withBoxToggled(codes, row, action));
    },
    toggleRow: (row) => {
      if (codes) write(withRowToggled(codes, row));
    },
    toggleCode: (code) => {
      if (codes) write(withCodeToggled(codes, code));
    },
    copyFrom: async (source, sourceLabel, label) => {
      if (!(role && codes) || refused()) return;
      let next: string[];
      try {
        next = await queryClient.fetchQuery({
          queryKey: orgQueryKeys.rolePermissions(organizationId, source.id),
          queryFn: () => getRolePermissions(source.id),
        });
      } catch (error) {
        notifyError(error);
        return;
      }
      if (next.some((code) => !(codes.includes(code) || canGive(code)))) {
        notify.info(t(USERS_KEYS.roles.locked.notYours));
        return;
      }
      try {
        await replace.mutateAsync({ permissions: next });
        notify.success(t(USERS_KEYS.roles.copied, { role: label, from: sourceLabel }));
      } catch {
        // The write raised its own error toast and put the boxes back.
      }
    },
  };
}
