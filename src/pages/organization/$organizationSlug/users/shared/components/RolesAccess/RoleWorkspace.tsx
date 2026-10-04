import { useTranslation } from 'react-i18next';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { MATRIX_PLATFORM_CODES } from '@/shared/api/clinic/access-api.ts';
import type { ClinicRoleView } from '@/shared/api/clinic/access-contracts.ts';
import { useAssignablePermissions } from '@/shared/hooks/useAssignablePermissions/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { RoleSwitchCard } from './RoleSwitchCard.tsx';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/**
 * "Workspace permissions" (D17 — Settings' role dialog, relocated): every
 * clinozy-be code the matrix doesn't map — settings, integrations, billing,
 * the audit log, uploads — as a switch card named by the catalog, for a role
 * clinozy-be backs. The viewer can give only what they hold
 * (`useAssignablePermissions`); a code the role holds beyond that is kept as
 * it is. Locked like the rest of the page: without "Change roles & access",
 * and for a role bound to a clinozy-be system role (D47).
 */
export function RoleWorkspace({
  role,
  codes,
  writes,
}: {
  role: ClinicRoleView;
  /** The role's clinozy-be permission codes. */
  codes: readonly OrganizationPermission[];
  writes: RoleAccessWrites;
}) {
  const { t } = useTranslation(USERS_NS);
  const assignable = useAssignablePermissions();
  if (assignable.isPending) return null;
  if (assignable.isError) {
    return (
      <span role="alert" className="text-detail text-destructive">
        {t(USERS_KEYS.roles.workspace.loadFailed)}
      </span>
    );
  }
  const rows = assignable.rows.filter(
    (entry) => !MATRIX_PLATFORM_CODES.includes(entry.code),
  );
  if (rows.length === 0) {
    return (
      <span className="text-detail text-muted-foreground">
        {t(USERS_KEYS.roles.workspace.none)}
      </span>
    );
  }
  return (
    <div
      data-testid="users-role-workspace"
      className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2"
    >
      {rows.map((entry) => (
        <RoleSwitchCard
          key={entry.code}
          tone={role.tone}
          on={codes.includes(entry.code)}
          locked={writes.lock !== null || writes.platformLocked}
          label={entry.name}
          title={entry.code}
          onToggle={() => writes.toggleCode(entry.code)}
          testId={`users-role-code-${entry.code}`}
        />
      ))}
    </div>
  );
}
