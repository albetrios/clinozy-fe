import { useTranslation } from 'react-i18next';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { useAssignablePermissions } from '@/shared/hooks/useAssignablePermissions/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { CLINIC_PERMISSION_CODES } from './roles-matrix.ts';
import { RoleSwitchCard } from './RoleSwitchCard.tsx';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/**
 * "Workspace permissions" (D17 — Settings' role dialog, relocated): every
 * clinozy-be code no box or special switch holds — settings, integrations,
 * billing, the audit log, uploads — as a switch card named by the catalog.
 * The viewer can give only what they hold (`useAssignablePermissions`).
 * Locked like the rest of the page.
 */
export function RoleWorkspace({
  tone,
  codes,
  writes,
}: {
  /** The role's tone: each track's fill when on. */
  tone: Tone;
  /** The role's clinozy-be permission codes. */
  codes: readonly string[];
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
    (entry) => !CLINIC_PERMISSION_CODES.has(entry.code),
  );
  if (rows.length === 0) {
    return <EmptyState variant="inline" title={t(USERS_KEYS.roles.workspace.none)} />;
  }
  return (
    <div
      data-testid="users-role-workspace"
      className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2"
    >
      {rows.map((entry) => (
        <RoleSwitchCard
          key={entry.code}
          tone={tone}
          on={codes.includes(entry.code)}
          locked={writes.lock !== null}
          label={entry.name}
          title={entry.code}
          onToggle={() => writes.toggleCode(entry.code)}
          testId={`users-role-code-${entry.code}`}
        />
      ))}
    </div>
  );
}
